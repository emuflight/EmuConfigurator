#!/bin/sh
#
# tom hensel <code@jitter.eu> for EmuFlight
#

#
# variables and composition
#

CERTIFICATE_P12="sign/EmuCert.p12"
KEYCHAIN="build.keychain"
ENTITLEMENTS_CHILD="sign/entitlements-child.plist"
ENTITLEMENTS_PARENT="sign/entitlements-parent.plist"
APP_PATH="apps/emuflight-configurator/osx64/emuflight-configurator.app"

VERSION_NUMBER=$(ls "${APP_PATH}/Contents/Versions/")

#
# sanity checks
#

if [ ! -d "${APP_PATH}" ]; then
  echo "unable to find application at: ${APP_PATH}"
  exit 2
fi

if [ -z "${APP_IDENTITY}" ]; then
  echo "required variable APP_IDENTITY not set"
  exit 3
fi

if [ -z "${BUNDLE_ID}" ]; then
  echo "required variable BUNDLE_ID not set"
  exit 4
fi

if [ -z "${TEAM_ID}" ]; then
  echo "required variable TEAM_ID not set"
  exit 5
fi

if [ ! -d "${APP_PATH}" ]; then
  echo "unable to find application at: ${APP_PATH}"
  exit 6
fi

if [ ! -f "${CERTIFICATE_P12}" ]; then
  echo "unable to find certifacte at: ${CERTIFICATE_P12}"
  exit 7
fi
 
if [ ! -f "${ENTITLEMENTS_CHILD}" ]; then
  echo "unable to find entitlement at: ${ENTITLEMENTS_CHILD}"
  exit 8
fi

if [ ! -f "${ENTITLEMENTS_PARENT}" ]; then
  echo "unable to find entitlement at: ${ENTITLEMENTS_PARENT}"
  exit 9
fi

#
# keychain
#

if [ "${TRAVIS_OS_NAME}" == "osx" ]; then
  security create-keychain -p "${KEYC_PASS}" "${KEYCHAIN}"
  security default-keychain -s "${KEYCHAIN}"
  security unlock-keychain -p "${KEYC_PASS}" "${KEYCHAIN}"
  echo "import cert to keychain"
  security import "${CERTIFICATE_P12}" -k "${KEYCHAIN}" -P "${CERT_PASS}" -T /usr/bin/codesign || exit 3
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "${KEYC_PASS}" "${KEYCHAIN}"
else
  echo "not running on travis and/or osx. skipping 'keychain' part"
fi

#
# bundle
#

/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ${BUNDLE_ID}" "${APP_PATH}/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :com.apple.security.application-groups:0 ${TEAM_ID}.${BUNDLE_ID}" "$ENTITLEMENTS_PARENT"

#
# unsealed content
#
# remove all unallowed files
xattr -cr "${APP_PATH}"

echo "fixing nwjs framework unsealed content"
NWJS_FRAMEWORK="${APP_PATH}/Contents/Versions/${VERSION_NUMBER}/nwjs Framework.framework"
LIBNODE_DYLIB="libnode.dylib"
LIBNODE_LINK_TO="Versions/A/${LIBNODE_DYLIB}"

pushd "${NWJS_FRAMEWORK}"
mv "${LIBNODE_DYLIB}" "${LIBNODE_LINK_TO}"
ln -s "${LIBNODE_LINK_TO}"
popd

#
# signing
#

sign () {
    OBJECT="${1}"
    ENTITLEMENTS="${2}"

    echo "signing: ${OBJECT}"
    codesign --verbose --force --options=runtime --sign "${APP_IDENTITY}" --entitlements "${ENTITLEMENTS}" --deep "${OBJECT}"
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

#
# check
#

spctl --assess --type execute "${APP_PATH}" || true
spctl --assess --verbose=4 "${APP_PATH}" || true
