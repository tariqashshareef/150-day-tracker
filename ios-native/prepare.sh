#!/bin/bash
# Runs on the macOS build machine after `npx cap add ios`: makes the generated project behave like this app.
set -euo pipefail

PL=ios/App/App/Info.plist
pb() { /usr/libexec/PlistBuddy -c "$1" "$PL" 2>/dev/null || true; }

# the name under the icon
pb "Set :CFBundleDisplayName 150 days"

# portrait only
pb "Delete :UISupportedInterfaceOrientations"
pb "Add :UISupportedInterfaceOrientations array"
pb "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait"

# the app's Documents folder shows in Files > On My iPhone > 150 days: the log copies itself there after every change
pb "Delete :UIFileSharingEnabled"
pb "Add :UIFileSharingEnabled bool true"
pb "Delete :LSSupportsOpeningDocumentsInPlace"
pb "Add :LSSupportsOpeningDocumentsInPlace bool true"

# a solid launch screen in the paper colour (cream by day, near-black by night) instead of the white storyboard
pb "Delete :UILaunchStoryboardName"
pb "Delete :UILaunchScreen"
pb "Add :UILaunchScreen dict"
pb "Add :UILaunchScreen:UIColorName string LaunchBackground"

mkdir -p ios/App/App/Assets.xcassets/LaunchBackground.colorset
cat > ios/App/App/Assets.xcassets/LaunchBackground.colorset/Contents.json <<'JSON'
{
  "colors": [
    {
      "idiom": "universal",
      "color": { "color-space": "srgb", "components": { "red": "0.957", "green": "0.929", "blue": "0.878", "alpha": "1.000" } }
    },
    {
      "idiom": "universal",
      "appearances": [ { "appearance": "luminosity", "value": "dark" } ],
      "color": { "color-space": "srgb", "components": { "red": "0.071", "green": "0.071", "blue": "0.078", "alpha": "1.000" } }
    }
  ],
  "info": { "author": "xcode", "version": 1 }
}
JSON

# the app icon: the red 日 seal
ICONS=ios/App/App/Assets.xcassets/AppIcon.appiconset
FILE=$(ls "$ICONS" | grep -m1 '\.png$')
cp ios-native/icon-1024.png "$ICONS/$FILE"

echo "prepared:"; /usr/libexec/PlistBuddy -c "Print" "$PL" | head -40
