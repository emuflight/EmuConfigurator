# Emuflight Configurator

**Emuflight Configurator** is a crossplatform configuration tool for the [Emuflight](https://github.com/emuflight) flight control system.

![Emuflight](.github/screenshot.png)

**Various types** of aircraft are supported by the tool and by Emuflight

 * quadcopters
 * hexacopters
 * octocopters
 * fixed-wing aircraft.

The application allows you to configure the Emuflight software running on any [supported Emuflight target](https://github.com/emuflight/EmuFlight/tree/master/src/main/target).

## Downloads

Please [download our releases](https://github.com/emuflight/EmuConfigurator/releases) at GitHub.

[![Build Status](https://travis-ci.org/emuflight/EmuConfigurator.svg?branch=master)](https://travis-ci.org/emuflight/EmuConfigurator)

## Authors

Emuflight Configurator is a [fork](#credits) of the Cleanflight Configurator with support for Emuflight instead of Cleanflight.

This configurator is the only configurator with support for Emuflight specific features!

If you are experiencing any problems please make sure you are running the [latest firmware version](https://github.com/emuflight/EmuFlight/releases).

## Installation

### Standalone

This is the default installation method, and at some point in the future this will become the only way available for most platforms. Please use this method whenever possible.

Please download the installer from the [Release](https://github.com/emuflight/EmuConfigurator/releases) page.

### Apple OSX/Mac

The application is signed and built on a secure environment but we are still working on notarization to get accepted on the Apple Store.

In the meantime, please `right-click` the application and select `Open` to be able to override the strict security restrictions.

### Experimental Test Builds

[Automated Builds](https://dl.bintray.com/emuflight/dev_cfg/) available to try on **your own risk**!

## Development

### Setup

 1. [Install Node.js](https://nodejs.org/en/download/package-manager/)
 2. Install yarn: `npm install yarn -g`
 3. Change to project folder and run: `yarn install`
 4. Run `yarn start`

### Run Tests

```shell
yarn test
```

### Build and Release

The tasks are defined in `gulpfile.js` and can be run with through yarn:

```shell
yarn gulp <taskname> [[platform] [platform] ...]
```

#### Available Tasks

List of possible values of `<task-name>`:

 * **dist** copies all the JS and CSS files in the `./dist` folder
 * **apps** builds the apps in the `./apps` folder [1]
 * **debug** builds debug version of the apps in the `./debug` folder [1]
 * **release** zips up the apps into individual archives in the `./release` folder [1]

#### Build or release app for one specific platform

To build or release only for one specific platform you can append the plaform after the `task-name`.
If no platform is provided, all the platforms will be done in sequence.

 * **MacOS** use `yarn gulp <task-name> --osx64`
 * **Linux** use `yarn gulp <task-name> --linux64`
 * **Windows** use `yarn gulp <task-name> --win32`
 * **ChromeOS** use `yarn gulp <task-name> --chromeos`

You can also use multiple platforms e.g. `yarn gulp <taskname> --osx64 --linux64`.

## Languages

Emuflight Configurator has been translated into [several languages](https://github.com/emuflight/EmuConfigurator/tree/master/locales).

The application will try to detect and use your system language if a translation into this language is available.

If you prefer to have the application in English or any other language, you can select your desired language in the options menu of the application.

## Notes

### WebGL

Make sure Settings -> System -> `Use hardware acceleration when available` is checked to achieve the best performance

### Linux users

Please add your user into the `dialout` group for serial access:

```shell
sudo usermod -aG dialout $USER
```

### Linux / MacOSX users

If you have 3D model animation problems, enable "Override software rendering list" in Chrome flags at

`chrome://flags/#ignore-gpu-blacklist`

## Support

If you need help __please__ reach out in [Emuflight support chat](https://discordapp.com/channels/547211754845765635/596913667447062547) on Discord before raising issues on Github.

Please register and [join via this link](https://discord.gg/gdP9CwE).

### Issue trackers

 * For Emuflight configurator issues raise them at
   https://github.com/emuflight/EmuConfigurator/issues
 * For Emuflight firmware issues raise them at
   https://github.com/emuflight/EmuFlight/issues

Thank you!

## Developers

We accept clean and reasonable patches, please [submit them](https://github.com/emuflight/EmuConfigurator/pulls)!

---

![Emuflight](.github/EmuFlight.png)
