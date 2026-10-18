#!/usr/bin/env python3
"""Writes the SideStore / AltStore source file (source.json) for the native build.

Run by .github/workflows/ios.yml right after the .ipa is packaged. Only the python standard library is used,
so the same script can be dry-run locally:

    python ios-native/make-source.py --ipa 150-days.ipa --version 1.0.7 --repo tariqashshareef/150-day-tracker \
        --sha 0123abc --out source.json

The version has to match CFBundleShortVersionString inside the app (the workflow stamps it into Info.plist and checks it),
because SideStore decides an update exists by comparing this number with the installed app's.
"""
import argparse
import datetime
import json
import os
import re
import sys

BUNDLE_ID = "com.tariq.d150"
SOURCE_ID = "com.tariq.d150.source"
RELEASE_TAG = "ios-latest"
IPA_NAME = "150-days.ipa"
SOURCE_NAME = "source.json"


def build(ipa, version, repo, sha):
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        sys.exit("version must be three dot separated integers, got %r" % version)
    size = os.path.getsize(ipa)
    if size <= 0:
        sys.exit("%s is empty" % ipa)

    base = "https://github.com/%s/releases/download/%s" % (repo, RELEASE_TAG)
    # the day, UTC, in the plain YYYY-MM-DD form the SideStore docs ask for
    date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    build_no = version.rsplit(".", 1)[1]   # 1.0.7 is build 7: the workflow sets both from the run number
    notes = "Build %s from commit %s." % (build_no, sha[:7])
    description = (
        "A daily tracker for 150 days, 20 oct 2026 to 18 mar 2027: data, gym, japanese, piano and sleep, "
        "one tap each. Native iPhone build with full screen, the system keyboard and haptics. "
        "Your log lives on the phone only, so export a backup from the days page now and then."
    )

    app = {
        "name": "150 days",
        "bundleIdentifier": BUNDLE_ID,
        "developerName": "tariq",
        "subtitle": "150 day tracker, 20 oct 2026 to 18 mar 2027",
        "localizedDescription": description,
        "iconURL": "https://raw.githubusercontent.com/%s/%s/ios-native/icon-1024.png" % (repo, sha),
        "appPermissions": {"entitlements": [], "privacy": {}},   # required by the current format; the app asks for nothing
        # current format: first entry is the latest
        "versions": [
            {
                "version": version,
                "buildVersion": build_no,   # required by the current format; the workflow stamps the same number into CFBundleVersion
                "date": date,
                "localizedDescription": notes,
                "downloadURL": "%s/%s" % (base, IPA_NAME),
                "size": size,
            }
        ],
        # the same release in the old flat form, deprecated but kept for older AltStore / SideStore builds
        "version": version,
        "versionDate": date,
        "versionDescription": notes,
        "downloadURL": "%s/%s" % (base, IPA_NAME),
        "size": size,
    }
    return {
        "name": "150 days",
        "identifier": SOURCE_ID,
        "nsfw": False,   # required by the current format
        "sourceURL": "%s/%s" % (base, SOURCE_NAME),
        "apps": [app],
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--ipa", required=True, help="path to the packaged .ipa (its size goes in the source)")
    p.add_argument("--version", required=True, help="x.y.z, must equal CFBundleShortVersionString in the app")
    p.add_argument("--repo", required=True, help="owner/name, for the release asset urls")
    p.add_argument("--sha", required=True, help="commit sha, pins the icon url and names the build")
    p.add_argument("--out", default=SOURCE_NAME)
    a = p.parse_args()

    source = build(a.ipa, a.version, a.repo, a.sha)
    text = json.dumps(source, indent=2, ensure_ascii=False) + "\n"
    json.loads(text)  # must parse back
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print(text, end="")


if __name__ == "__main__":
    main()
