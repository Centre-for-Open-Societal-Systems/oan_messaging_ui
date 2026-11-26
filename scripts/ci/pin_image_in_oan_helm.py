# ruff: noqa: E501, S310  (stdlib-only CI script: https GitHub API)
"""Move one image pin of the OAN Messaging release in oan-helm.

    pin_image_in_oan_helm.py <service|ui> <tag> <sha256:digest>

Run by the Jenkins job after it pushed the image of a develop build. It changes the one `tag:` line
of that image in environments/dev/values/oan-messaging.yaml of Centre-for-Open-Societal-Systems/oan-helm
to `<tag>@<digest>` (images are pinned by digest there) and commits that one file straight to oan-helm's
default branch through the GitHub contents API, with the Jenkins credential oan-helm-fork-token, as the
other automation accounts of oan-helm (the chart publisher and the seed pinner) already do. No fork, no
pull request, no git push. The commit is by `oan-image-pinner`. When it lands, the oan-helm-dev-commons
job delivers the release to New Dev. A pin that is already in oan-helm does nothing.

This exception covers only this automated tag pin; every human or agent change to oan-helm still goes
fork, pull request, review.

Environment: GH_TOKEN (the credential's token; GH_USER is accepted and ignored);
OAN_HELM_UPSTREAM (default Centre-for-Open-Societal-Systems/oan-helm). The token is never printed.
Standard library only.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
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


def _send(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, object]:
    """One GitHub API call: (status, JSON body on success, message on failure).

    GitHub 5xx answers and network errors are retried (4 attempts, growing pause), so a transient 502 does not
    fail a build whose image is already pushed. The token is never shown.
    """
    for attempt in range(1, 5):
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
                return r.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            try:
                message = json.loads(e.read()).get("message", "")
            except ValueError:
                message = ""
            if e.code < 500 or attempt == 4:
                return e.code, message.replace(token, "***")[:200]
            print(f"{method} {url.split('?')[0]}: HTTP {e.code}; retrying ({attempt}/3)")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 4:
                return 599, type(e).__name__
            print(f"{method} {url.split('?')[0]}: {type(e).__name__}; retrying ({attempt}/3)")
        time.sleep(2 * attempt)
    return 599, "no attempt made"


def api(method: str, url: str, token: str, body: dict | None = None):
    status, data = _send(method, url, token, body)
    if status >= 400:
        sys.exit(f"{method} {url.split('?')[0]} failed: HTTP {status} {data}")
    return data


def try_api(method: str, url: str, token: str, body: dict | None = None) -> tuple[int, str]:
    """Status and message of a call that may fail; never raises, never shows the token."""
    status, data = _send(method, url, token, body)
    return status, data if isinstance(data, str) else ""


def main(argv: list[str]) -> int:
    if len(argv) != 3 or argv[0] not in PATHS:
        sys.exit("usage: pin_image_in_oan_helm.py <service|ui> <tag> <sha256:digest>")
    key, tag, digest = argv
    value = f"{tag}@{digest}"
    if not TAG.fullmatch(value):
        sys.exit(f"refusing to pin {value!r}: expected N.N.N-develop.N@sha256:<64 hex>")
    token = os.environ["GH_TOKEN"]
    upstream = os.environ.get("OAN_HELM_UPSTREAM", "Centre-for-Open-Societal-Systems/oan-helm")
    repo = f"https://api.github.com/repos/{upstream}"
    branch = api("GET", repo, token)["default_branch"]
    for attempt in range(1, 6):
        current = api("GET", f"{repo}/contents/{VALUES}?ref={branch}", token)
        text = base64.b64decode(current["content"]).decode("utf-8")
        if get_value(text, PATHS[key]) == value:
            print(f"{key} is already pinned to {value} in oan-helm; nothing to do")
            return 0
        done = try_api(
            "PUT",
            f"{repo}/contents/{VALUES}",
            token,
            {
                "message": f"Pin the OAN Messaging {key} image to {tag} for New Dev",
                "content": base64.b64encode(
                    set_value(text, PATHS[key], value).encode("utf-8")
                ).decode(),
                "sha": current["sha"],
                "branch": branch,
                "author": {"name": AUTHOR[0], "email": AUTHOR[1]},
                "committer": {"name": AUTHOR[0], "email": AUTHOR[1]},
            },
        )
        if done[0] < 300:
            print(f"pinned the {key} image to {value} in oan-helm")
            return 0
        if done[0] not in (409, 422):  # a concurrent change of the file: read it again and retry
            sys.exit(f"cannot pin the {key} image: HTTP {done[0]} {done[1]}")
        print(f"attempt {attempt}: the file changed meanwhile (HTTP {done[0]} {done[1]}); retrying")
    sys.exit("cannot pin the image: the file kept changing")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
