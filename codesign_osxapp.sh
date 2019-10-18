#!/bin/sh
#
# The Emuflight Project

#set -e

APP_IDENTITY="BC7GB98TFH"
CERTIFICATE_P12="sign/EmuCert.p12"
KEYCHAIN="build.keychain"
ENTITLEMENTS_CHILD="sign/entitlements-child.plist"
ENTITLEMENTS_PARENT="sign/entitlements-parent.plist"

APP_PATH="apps/emuflight-configurator/osx64/emuflight-configurator.app"
ls -lsa "${APP_PATH}" || exit 2

VERSION_NUMBER=`ls "${APP_PATH}/Contents/Versions/"`

echo "${CERTIFICATE_OSX_P12}" | base64 — decode > $CERTIFICATE_P12

security create-keychain -p $KEYC_PASS $KEYCHAIN
security default-keychain -s $KEYCHAIN
security unlock-keychain -p $KEYC_PASS $KEYCHAIN
security import $CERTIFICATE_P12 -k $KEYCHAIN -P $CERT_PASS -T /usr/bin/codesign

sign () {
    OBJECT="${1}"
    ENTITLEMENTS="${2}"

    echo "signing: ${OBJECT}"
    codesign --verbose=2 --force --verify --sign "${APP_IDENTITY}" --entitlements "${ENTITLEMENTS}" --deep "${OBJECT}"
    echo "verifying: ${OBJECT}"
    codesign --verbose=2 --verify --strict --deep "${OBJECT}"
}

sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework/libnode.dylib" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework/Helpers/crashpad_handler" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework/XPCServices/AlertNotificationService.xpc" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework/Versions/Current/nwjs Framework" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework/libffmpeg.dylib" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Helper.app" "$ENTITLEMENTS_CHILD"
sign "${APP_PATH}" "$ENTITLEMENTS_PARENT"

echo "fixing nwjs framework unsealed content"

NWJS_FRAMEWORK="${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework"
LIBNODE_DYLIB="libnode.dylib"
LIBNODE_LINK_TO="Versions/A/${LIBNODE_DYLIB}"

pushd "${NWJS_FRAMEWORK}"
mv "${LIBNODE_DYLIB}" "${LIBNODE_LINK_TO}"
ln -s "${LIBNODE_LINK_TO}"
popd

# /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" "${APP_PATH}/Contents/Info.plist"
# /usr/libexec/PlistBuddy -c "Set :com.apple.security.application-groups:0 $TEAM_ID.$BUNDLE_ID" "$ENTITLEMENTS_PARENT"
