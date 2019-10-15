#!/bin/bash -x
#
# travis continuous integration build script for
# EmuConfigurator

# get version string from 'package.json'
export CONFIGURATOR_VERSION="$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[ ",]//g')"

# compose string to reference the package
export PACKAGE_VERSION="${CONFIGURATOR_VERSION}-${TRAVIS_BUILD_NUMBER}-${TRAVIS_OS_NAME}"

# process template for pushing to bintray (deploy step will pick it up)
j2 bintray-template.j2 -o bintray-conf.json
cat bintray-conf.json # DEBUG

# build the apps
yarn install
yarn gulp release
if [ "$TRAVIS_OS_NAME" == "linux" ]; then yarn gulp release --chromeos; fi
