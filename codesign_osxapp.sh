#!/bin/sh -x
#
# The Emuflight Project

APP_IDENTITY="Mac Developer: Tom Hensel (BC7GB98TFH)"
CERTIFICATE_P12="sign/EmuCert.p12"
KEYCHAIN="build.keychain"
ENTITLEMENTS_CHILD="sign/entitlements-child.plist"
ENTITLEMENTS_PARENT="sign/entitlements-parent.plist"

APP_PATH="${HOME}/build/emuflight/EmuConfigurator/apps/emuflight-configurator/osx64/Emuflight Configurator.app"
ls -lsa "${APP_PATH}"

VERSION_NUMBER=`ls "${APP_PATH}/Contents/Versions/"`
NWJS_FRAMEWORK="${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework"
LIBNODE_DYLIB="libnode.dylib"
LIBNODE_LINK_TO="Versions/A/${LIBNODE_DYLIB}"

echo "${CERTIFICATE_OSX_P12}" | base64 — decode > $CERTIFICATE_P12

security create-keychain -p $KEYC_PASS $KEYCHAIN
security default-keychain -s $KEYCHAIN
security unlock-keychain -p $KEYC_PASS $KEYCHAIN
security import $CERTIFICATE_P12 -k $KEYCHAIN -P $CERT_PASS -T /usr/bin/codesign

sign () {
    OBJECT=$1
    ENTITLEMENTS=$2

    codesign --force --verbose --verify --sign "$APP_IDENTITY" --entitlements "$ENTITLEMENTS" --deep "$OBJECT"
    codesign --verify --deep --strict --verbose=2 "$OBJECT"
}

sign "$APP/Contents/Versions/63.0.3239.84/nwjs Framework.framework/libnode.dylib" "$ENTITLEMENTS_CHILD"
sign "$APP/Contents/Versions/63.0.3239.84/nwjs Framework.framework/Helpers/crashpad_handler" "$ENTITLEMENTS_CHILD"
sign "$APP/Contents/Versions/63.0.3239.84/nwjs Framework.framework/XPCServices/AlertNotificationService.xpc" "$ENTITLEMENTS_CHILD"
sign "$APP/Contents/Versions/63.0.3239.84/nwjs Framework.framework/nwjs Framework" "$ENTITLEMENTS_CHILD"
# sign "$APP/Contents/Versions/63.0.3239.84/nwjs Framework.framework" "$ENTITLEMENTS_CHILD"
sign "$APP/Contents/Versions/63.0.3239.84/nwjs Helper.app" "$ENTITLEMENTS_CHILD"
sign "$APP/Contents/Versions/63.0.3239.84/libffmpeg.dylib" "$ENTITLEMENTS_CHILD"
sign "$APP" "$ENTITLEMENTS_PARENT"

echo "fixing nwjs framework unsealed content"
pushd "$NWJS_FRAMEWORK"
mv "$LIBNODE_DYLIB" "$LIBNODE_LINK_TO"
ln -s "$LIBNODE_LINK_TO"
popd

# /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" "$APP_PATH/Contents/Info.plist"
# /usr/libexec/PlistBuddy -c "Set :com.apple.security.application-groups:0 $TEAM_ID.$BUNDLE_ID" "$ENTITLEMENTS_PARENT"
