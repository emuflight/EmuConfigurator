#!/bin/bash
#
# travis continuous integration build script for
# Emuflight

# get version string from 'version.h'
export EMU_VERSION="$(make version)"

# compose string to reference the artifacts (binaries)
export PACKAGE_VERSION="${EMU_VERSION}-${TRAVIS_BUILD_NUMBER}"

yarn test || exit $?
yarn gulp apps
#if [ "$TRAVIS_OS_NAME" == "linux" ]; then yarn gulp release --chromeos; fi

# process template for pushing to bintray
j2 bintray-template.j2 -o bintray-conf.json
cat bintray-conf.json # DEBUG
