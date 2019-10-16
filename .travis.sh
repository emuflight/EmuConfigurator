#!/bin/bash
#
# travis continuous integration build script for
# EmuConfigurator

# get version string from 'package.json'
export CONFIGURATOR_VERSION="$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[ ",]//g')"

# compose string to reference the package
export PACKAGE_VERSION="${CONFIGURATOR_VERSION}-${TRAVIS_BUILD_NUMBER}-${TRAVIS_OS_NAME}"

# install dependencies
yarn install || exit $?

# build releases for each platform
case "${TRAVIS_OS_NAME}" in
	linux)
		yarn gulp release --chromeos
		break
		;;
	osx)
		yarn gulp release --osx64
		break
		;;
	windows)
		iwr -useb get.scoop.sh | iex
		scoop bucket add nsis https://github.com/NSIS-Dev/scoop-nsis
		scoop install nsis/nsis
		yarn gulp release --win32
		break
		;;
	*)
		echo "platform ${TRAVIS_OS_NAME} not supported for now."
		exit 10
		;;
esac

# process template for pushing to bintray ('deploy' step on travis will pick it up)
j2 bintray-template.j2 -o bintray-conf.json
#cat bintray-conf.json # DEBUG

exit 0
