#!/bin/bash
#
# travis continuous integration build script for
# EmuConfigurator

# get version string from 'version.h'
export CFG_VERSION="$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[ ",]//g')"

# compose string to reference the artifacts (binaries)
export PACKAGE_VERSION="${CFG_VERSION}-${TRAVIS_BUILD_NUMBER}"

yarn test || exit $?
yarn gulp apps
#if [ "$TRAVIS_OS_NAME" == "linux" ]; then yarn gulp release --chromeos; fi

# process template for pushing to bintray
j2 bintray-template.j2 -o bintray-conf.json
cat bintray-conf.json # DEBUG
