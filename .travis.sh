#!/bin/bash -x
#
# travis continuous integration build script for
# EmuConfigurator

# get version string from 'version.h'
export CFG_VERSION="$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[ ",]//g')"

# compose string to reference the artifacts (binaries)
export PACKAGE_VERSION="${CFG_VERSION}-${TRAVIS_BUILD_NUMBER}-${TRAVIS_OS_NAME}"

# compose name of zip file to create
export ZIP_FILE="apps/EmuConfigurator-${PACKAGE_VERSION}.zip"

# process template for pushing to bintray
j2 bintray-template.j2 -o bintray-conf.json
cat bintray-conf.json # DEBUG

# build the apps
yarn gulp apps
#if [ "$TRAVIS_OS_NAME" == "linux" ]; then yarn gulp release --chromeos; fi

# zip it together
case "${TRAVIS_OS_NAME}" in
    osx)
        zip -qr "${ZIP_FILE}" apps/emuflight-configurator/osx64
        ;;
    linux)
        zip -qr "${ZIP_FILE}" apps/emuflight-configurator/linux64
        ;;
    windows)
        zip -qr "${ZIP_FILE}" apps/emuflight-configurator/win32
        ;;
esac
