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
# extended attributes
#

# TODO: check if this is any effective
echo "recursively remove quarantine attribute"
xattr -r -d com.apple.quarantine "${APP_PATH}"

#
# bundle id
#

/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ${BUNDLE_ID}" "${APP_PATH}/Contents/Info.plist"

#
# signing
#

codesign --verbose --force --sign "${APP_IDENTITY}" --timestamp --entitlements "${ENTITLEMENTS_PARENT}" --deep "${APP_PATH}"
codesign --verbose --verify --strict --deep "${APP_PATH}"

#
# check
#

# should result in 'satisfies its Designated Requirement' at least
spctl --assess --type execute "${APP_PATH}" || true
spctl --assess --verbose=4 "${APP_PATH}" || true

exit 0
