# ruff: noqa: E501, S310  (stdlib-only CI script: https GitHub API)
"""Move one image pin of the OAN Messaging release in oan-helm, by pull request.

    pin_image_in_oan_helm.py <service|ui> <tag> <sha256:digest>

Run by the Jenkins job after it pushed the image of a develop build. It changes the one `tag:` line
of that image in environments/dev/values/oan-messaging.yaml of Centre-for-Open-Societal-Systems/oan-helm
to `<tag>@<digest>` (images are pinned by digest there) and opens a pull request into oan-helm from
a branch on the pipeline account's fork. Nothing is ever pushed to the upstream repository itself. When that
pull request is merged, the oan-helm-dev-commons job delivers the release to New Dev.

An older open pin pull request for the same image (branch bot/oan-messaging-<image>-*) is closed. A pin that
is already in oan-helm does nothing.

Environment: GH_USER, GH_TOKEN (Jenkins credential oan-helm-fork-token: the account that owns the fork
<GH_USER>/oan-helm); OAN_HELM_UPSTREAM (default Centre-for-Open-Societal-Systems/oan-helm).
Only the GitHub API is used (no git push): a personal access token may not push a tree that holds
.github/workflows files, and a shallow clone makes every file look new. The branch is created in the fork at
the upstream commit (a fork shares the upstream's objects) and the one values file is committed on it through
the contents API, so the pull request is exactly that one line. The token is never printed. Standard library only.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request

VALUES = "environments/dev/values/oan-messaging.yaml"
#: image key -> path of its tag in the values file
PATHS = {
    "service": ("oan-messaging-service", "image", "tag"),
    "ui": ("ui", "image", "tag"),
}
TAG = re.compile(r"\d+\.\d+\.\d+-develop\.\d+@sha256:[0-9a-f]{64}")
AUTHOR = ("oan-image-pinner", "oan-image-pinner@users.noreply.github.com")


def _find(lines: list[str], path: tuple[str, ...]) -> int:
    """Index of the line holding the last key of `path` (nested block mappings)."""
    start, parent, child = 0, -1, None
    for depth, key in enumerate(path):
        hit = None
        for i in range(start, len(lines)):
            raw = lines[i]
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                continue
            ind = len(raw) - len(raw.lstrip(" "))
            if depth > 0 and ind <= parent:
                break  # left the parent's block
            if child is None and depth > 0:
                child = ind  # the first key under the parent fixes the child indent
            if ind == (0 if depth == 0 else child) and re.match(rf"{re.escape(key)}:", stripped):
                hit = i
                break
        if hit is None:
            raise ValueError(f"{'.'.join(path)} not found in the values file")
        start, parent, child = hit + 1, len(lines[hit]) - len(lines[hit].lstrip(" ")), None
    return hit  # type: ignore[possibly-undefined]


def set_value(text: str, path: tuple[str, ...], value: str) -> str:
    """Replace the scalar at `path`, keeping every other byte."""
    lines = text.splitlines(keepends=True)
    i = _find(lines, path)
    body = lines[i].rstrip("\r\n")
    m = re.match(rf"^(\s*{re.escape(path[-1])}:\s*)(\S+)(\s*(#.*)?)$", body)
    if not m:
        raise ValueError(f"{'.'.join(path)} is not a plain scalar")
    lines[i] = f"{m.group(1)}{value}{m.group(3)}{lines[i][len(body) :]}"
    return "".join(lines)


def get_value(text: str, path: tuple[str, ...]) -> str:
    lines = text.splitlines()
    return re.sub(r"^\s*[^:]+:\s*", "", lines[_find(lines, path)]).split(" #")[0].strip()


def api(method: str, url: str, token: str, body: dict | None = None, ok404: bool = False):
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "oan-image-pinner",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        if ok404 and e.code in (404, 422):
            return None
        detail = e.read().decode(errors="replace")[:300].replace(token, "***")
        sys.exit(f"{method} {url.split('?')[0]} failed: HTTP {e.code} {detail}")
    return json.loads(raw) if raw else None


def main(argv: list[str]) -> int:
    if len(argv) != 3 or argv[0] not in PATHS:
        sys.exit("usage: pin_image_in_oan_helm.py <service|ui> <tag> <sha256:digest>")
    key, tag, digest = argv
    value = f"{tag}@{digest}"
    if not TAG.fullmatch(value):
        sys.exit(f"refusing to pin {value!r}: expected N.N.N-develop.N@sha256:<64 hex>")
    user, token = os.environ["GH_USER"], os.environ["GH_TOKEN"]
    upstream = os.environ.get("OAN_HELM_UPSTREAM", "Centre-for-Open-Societal-Systems/oan-helm")
    fork = f"{user}/{upstream.split('/')[1]}"
    gh = "https://api.github.com/repos"
    branch = f"bot/oan-messaging-{key}-{tag}"

    base = api("GET", f"{gh}/{upstream}/branches/main", token)["commit"]["sha"]
    current = api("GET", f"{gh}/{upstream}/contents/{VALUES}?ref={base}", token)
    text = base64.b64decode(current["content"]).decode("utf-8")
    if get_value(text, PATHS[key]) == value:
        print(f"{key} is already pinned to {value} in oan-helm; nothing to do")
        return 0
    new_text = set_value(text, PATHS[key], value)

    # The branch in the fork starts at the upstream commit; an old branch of the same name is moved onto it.
    ref = f"{gh}/{fork}/git/refs"
    if api("POST", ref, token, {"ref": f"refs/heads/{branch}", "sha": base}, ok404=True) is None:
        api("PATCH", f"{ref}/heads/{branch}", token, {"sha": base, "force": True})
    api(
        "PUT",
        f"{gh}/{fork}/contents/{VALUES}",
        token,
        {
            "message": f"Pin the OAN Messaging {key} image to {tag} for New Dev",
            "content": base64.b64encode(new_text.encode("utf-8")).decode(),
            "sha": current["sha"],
            "branch": branch,
            "author": {"name": AUTHOR[0], "email": AUTHOR[1]},
            "committer": {"name": AUTHOR[0], "email": AUTHOR[1]},
        },
    )

    # Close an older pin PR of this image, then open the new one.
    for pr in api("GET", f"{gh}/{upstream}/pulls?state=open&per_page=100", token) or []:
        old = pr["head"]["ref"]
        if (
            old.startswith(f"bot/oan-messaging-{key}-")
            and old != branch
            and pr["head"]["user"]["login"] == user
        ):
            api("POST", pr["comments_url"], token, {"body": f"Superseded by the pin to {tag}."})
            api("PATCH", pr["url"], token, {"state": "closed"})
            print(f"closed superseded pin PR #{pr['number']}")
    if api("GET", f"{gh}/{upstream}/pulls?state=open&head={user}:{branch}", token):
        print("pull request already open for this pin")
        return 0
    pr = api(
        "POST",
        f"{gh}/{upstream}/pulls",
        token,
        {
            "title": f"Pin the OAN Messaging {key} image to {tag} for New Dev",
            "head": f"{user}:{branch}",
            "base": "main",
            "maintainer_can_modify": True,
            "body": (
                f"Opened by the Jenkins job of the {key} repository after its develop build pushed the image.{chr(10)}{chr(10)}"
                f"Changes only the `tag:` line of the {key} image in `{VALUES}` to `{value}`. "
                "Merging starts `oan-helm-dev-commons`, which delivers the release to New Dev "
                "(`scripts/ci/deliver_dev_oan_messaging.sh`)."
            ),
        },
    )
    print(f"opened {pr['html_url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
