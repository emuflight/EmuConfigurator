#!/bin/bash
#
# travis continuous integration build script for
# EmuConfigurator

# get version string from 'package.json'
export CONFIGURATOR_VERSION="$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[ ",]//g')"

# compose string to reference the package
export PACKAGE_VERSION="${CONFIGURATOR_VERSION}-${TRAVIS_BRANCH}-${TRAVIS_BUILD_NUMBER}-${TRAVIS_OS_NAME}"

# install dependencies
yarn --frozen-lockfile || exit $?
yarn gulp clean-release

# build releases for each platform
case "${TRAVIS_OS_NAME}" in
    linux)
        yarn gulp release --chromeos
        yarn gulp release --linux64
        ;;
    osx)
        yarn gulp release --osx64
        ;;
    windows)
        yarn gulp clean-release
        yarn gulp mrelease --win32
        yarn gulp mrelease --win64
        ;;
    *)
        echo "platform ${TRAVIS_OS_NAME} not supported for now."
        exit 2
        ;;
esac

ls -lsa release/

# process template for pushing to bintray ('deploy' step on travis will pick it up)
j2 bintray-template.j2 -o bintray-conf.json

exit 0
