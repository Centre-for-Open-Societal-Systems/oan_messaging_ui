# ruff: noqa: E501, S310, S603  (stdlib-only CI script: https GitHub API and a fixed git command line)
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
The token is passed to git as a request header and never printed. Standard library only.
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

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


def api(method: str, url: str, token: str, body: dict | None = None):
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
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 - https GitHub API
        raw = r.read()
    return json.loads(raw) if raw else None


def git(args: list[str], cwd: Path, token: str) -> str:
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    cmd = [
        "git",
        "-c",
        f"http.extraheader=AUTHORIZATION: basic {basic}",
        "-c",
        f"user.name={AUTHOR[0]}",
        "-c",
        f"user.email={AUTHOR[1]}",
        *args,
    ]
    done = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
    if done.returncode:
        # The command line holds the token header; report only the git subcommand and its stderr.
        sys.exit(f"git {args[0]} failed: {done.stderr.strip().replace(token, '***')[:300]}")
    return done.stdout


def main(argv: list[str]) -> int:
    if len(argv) != 3 or argv[0] not in PATHS:
        sys.exit("usage: pin_image_in_oan_helm.py <service|ui> <tag> <sha256:digest>")
    key, tag, digest = argv
    value = f"{tag}@{digest}"
    if not TAG.fullmatch(value):
        sys.exit(f"refusing to pin {value!r}: expected N.N.N-develop.N@sha256:<64 hex>")
    user, token = os.environ["GH_USER"], os.environ["GH_TOKEN"]
    upstream = os.environ.get("OAN_HELM_UPSTREAM", "Centre-for-Open-Societal-Systems/oan-helm")
    branch = f"bot/oan-messaging-{key}-{tag}"
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp) / "oan-helm"
        git(
            [
                "clone",
                "--quiet",
                "--depth",
                "1",
                "--branch",
                "main",
                f"https://github.com/{upstream}.git",
                str(work),
            ],
            Path(tmp),
            token,
        )
        path = work / VALUES
        text = path.read_text(encoding="utf-8")
        if get_value(text, PATHS[key]) == value:
            print(f"{key} is already pinned to {value} in oan-helm; nothing to do")
            return 0
        path.write_text(set_value(text, PATHS[key], value), encoding="utf-8", newline="")
        git(["checkout", "--quiet", "-b", branch], work, token)
        git(
            ["commit", "--quiet", "-am", f"Pin the OAN Messaging {key} image to {tag} for New Dev"],
            work,
            token,
        )
        git(
            ["push", "--quiet", "--force", f"https://github.com/{user}/oan-helm.git", branch],
            work,
            token,
        )
    # Close an older pin PR of this image, then open the new one.
    for pr in (
        api("GET", f"https://api.github.com/repos/{upstream}/pulls?state=open&per_page=100", token)
        or []
    ):
        ref = pr["head"]["ref"]
        if (
            ref.startswith(f"bot/oan-messaging-{key}-")
            and ref != branch
            and pr["head"]["user"]["login"] == user
        ):
            api("POST", pr["comments_url"], token, {"body": f"Superseded by the pin to {tag}."})
            api("PATCH", pr["url"], token, {"state": "closed"})
            print(f"closed superseded pin PR #{pr['number']}")
    existing = api(
        "GET",
        f"https://api.github.com/repos/{upstream}/pulls?state=open&head={user}:{branch}",
        token,
    )
    if existing:
        print(f"pull request already open: {existing[0]['html_url']}")
        return 0
    pr = api(
        "POST",
        f"https://api.github.com/repos/{upstream}/pulls",
        token,
        {
            "title": f"Pin the OAN Messaging {key} image to {tag} for New Dev",
            "head": f"{user}:{branch}",
            "base": "main",
            "maintainer_can_modify": True,
            "body": (
                f"Opened by the Jenkins job of the {key} repository after its develop build pushed the image.\n\n"
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
