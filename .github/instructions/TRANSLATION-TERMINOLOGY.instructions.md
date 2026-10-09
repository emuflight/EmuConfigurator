---
name: EmuFlight/Betaflight/iNav Translation Terminology Guide
description: Reference for terms that should remain in English across all non-English locales
applyTo: "locales/**/*.json"
---

# Translation Terminology — English Terms to Preserve

> **CRITICAL:** This guide is about MESSAGE VALUES only. Key names are NEVER translated under any circumstances. See LOCALE-MAINTENANCE.instructions.md for key naming rules.

## Overview
When translating EmuFlight messages and UI labels, certain technical terms and acronyms should **always remain in English** because they are:
- Industry-standard terms used in flight control firmware documentation
- Hardware/protocol names tied to vendor naming
- Acronyms that don't translate meaningfully
- Terms where the English version is universally recognized in aviation/FPV communities

## Preservation Strategy
1. **Verbatim Terms**: Keep technical acronyms and terms exact (Reference Categories 1-7).
2. **Inheritance over Redundancy**: If a technical term is short and identical to English in the source (e.g., "GPS", "CLI", "OSD", "RSSI", "Failsafe"), **DO NOT** add it to the target locale file. Let it fall back to the English base to minimize file weight.
3. **Restricted Terms**: If a term is identical in English and the target language but is NOT a technical term (e.g., "Error", "Motor" in some dialects), it should still be removed from the target file if it matches the source exactly, relying on the fallback mechanism. **CAUTION**: Do NOT remove terms if they contain functional metadata (HTML, variables, CSS classes) that must be preserved or localized.
4. **No-Translate Keys**: Any key with `"description": "Don't translate!!!"` must be removed from target files.
5. **Authentic Action UI**: Core UI action labels (Connect, Save, Reboot, Disconnect) and primary settings (Expert Mode, Language Selection) **must** be localized authentically in the target language to ensure the functional interface is user-friendly, even if the English label is short.

## Research Validation (Updated 2026-04-12)

The following terms have been cross-referenced and standardized across official Betaflight, EmuFlight, and iNav documentation:

**Critical Standardization Decision:** DSHOT
- **All caps form: `DSHOT`** (official de facto standard per blck.mn spec, INAV docs, Betaflight wiki)
- **NOT:** `DShot`, `Dshot`, `d-shot`, `D-shot`, `dShot`
- **Rationale:** All-caps form survives translation intact and prevents translator ambiguity

**Confirmed from Official Documentation:**
- EmuFlight Wiki: Features use exact spelling "Feathered PIDs", "i-Decay", "iTerm Relax", "Direct Yaw Feed Forward"
- PID components are: P-Term, I-Term, D-Term, FF
- Motor protocols: DSHOT (all caps), ProShot1000, Multishot, Oneshot, PWM, Brushless
- Sensors: gyro, accel (accelerometer), baro (barometer), mag (magnetometer), GPS, OSD
- OSD: consistent usage across all three firmwares
- Filter types: Biquad, PT1, Notch, Kalman
- Interfaces: UART, SPI, I2C, ADC, DMA
- Control: Setpoint, Deadband, RC (Radio Control), TX/RX
- Failsafe: treated as untranslatable technical term (use canonical `Failsafe` across all locales)

## Category 1: PID Control Terms

**Always in English:**
- `PID` (Proportional-Integral-Derivative)
- `P-Term` / `P-gain` / `Proportional`
- `I-Term` / `I-gain` / `Integral`
- `D-Term` / `D-gain` / `Derivative`
- `iTerm Relax` (exact spelling from EmuFlight)
- `i-Decay` (exact spelling from EmuFlight; controls I-Term decay)
- `FF` / `Feedforward`
- `setpoint` / `Setpoint`
- `deadband` / `Deadband`
- `Super Rate`
- `RC Rate`
- `RC Expo`
- `Feathered PIDs` (EmuFlight feature; changes D-Term calculation; "Feathered" is intentional naming)
- `Anti Gravity`
- `D Setpoint Weight`
- `Notch Filter`
- `Biquad` / `PT1` (filter types)
- `Rate Dynamics`
- `Direct Yaw Feed Forward`

## Category 2: Axis/Orientation Terms

**Always in English:**
- `Roll`
- `Pitch`
- `Yaw`
- `X`, `Y`, `Z` (axes)
- `RP` (Roll/Pitch combined, as shorthand)
- `RY` (Roll/Yaw combined, as shorthand)
- `PY` (Pitch/Yaw combined, as shorthand)

## Category 3: Sensor/Hardware Terms

**Always in English:**
- `gyro` / `Gyro` / `Gyroscope`
- `accel` / `Accelerometer`
- `baro` / `Barometer`
- `mag` / `Magnetometer`
- `GPS`
- `IMU` (Inertial Measurement Unit)
- `OSD` (On-Screen Display)
- `CLI` (Command-Line Interface)
- `Blackbox` / `Black Box`
- `ADC` (Analog-to-Digital Converter)
- `DMA` (Direct Memory Access)
- `USB`
- `UART`
- `SPI`
- `I2C`
- `PWM` (Pulse-Width Modulation)
- `DFU` (Device Firmware Update)
- `STM32` (microcontroller series)

## Category 4: Motor/ESC Protocol Terms

**Always in English:**
- `Motor(s)` (may keep to distinguish from "engine" in Romance languages)
- `ESC` (Electronic Speed Controller)
- `DSHOT` (protocol; **all caps, no variations** — not "DShot", "Dshot", or "d-shot")
- `ProShot1000` (ESC protocol variant)
- `KISS` (ESC protocol name)
- `Multishot`
- `Oneshot`
- `PWM` (as protocol variant)
- `Brushless`
- `BLHeli` / `BLHeli_S` (ESC firmware name)

## Category 5: Firmware & Configuration Terms

**Always in English:**
- `Betaflight`
- `EmuFlight`
- `iNav` / `Inav`
- `Cleanflight` (historical reference)
- `Target` (hardware target/board)
- `Firmware`
- `Bootloader`
- `HEX` (firmware file format; e.g., `.hex` file — keep `HEX` verbatim in all messages)
- `Configuration` (may translate in UI context, but use "Configuration" in technical settings names)
- `Preset`
- `Failsafe` (protocol/feature; treated as untranslatable technical term — use capitalized form consistently)

## Category 6: User Interface & Function Terms

**Always in English:**
- `Tab`
- `Port(s)`
- `Baud Rate` (can localize as needed, but "Baud" stays)
- `V` (Volts—single letter unit)
- `mAh` (milliamp-hours)
- `A` / `Amps`
- `Hz` (Hertz—frequency unit)
- `kHz` / `MHz`
- `Rate` / `Rates`
- `RC` (Radio Control)
- `TX` / `RX` (Transmitter/Receiver)
- `Crossfire` (TBS Crossfire — long-range RC link protocol)
- `Tracer` (TBS Tracer — long-range RC link protocol, distinct from Crossfire)
- `S-BUS` / `S.BUS`
- `CRSF`
- `PPM`
- `SBUS`
- `Spektrum`
- `FrSky`
- `Futaba`
- `Tuning`
- `Profile`
- `Enable` / `Disable` _(keep English in technical documentation; **translate** as UI action button labels — see Preservation Strategy §5)_
- `Reset` _(keep English in technical documentation; **translate** as UI action button labels — see Preservation Strategy §5)_
- `Reboot` / `Restart` _(keep English in technical documentation; **translate** as UI action button labels — see Preservation Strategy §5)_
- `Boot`
- `Erase`
- `Flash` (verb: to program firmware)
- `Range`
- `Scale`
- `Threshold`
- `Value`
- `Default` _(keep English in technical documentation; **translate** as UI action button labels — see Preservation Strategy §5)_

## Category 7: RC/Filter/Loop Terms

**Always in English:**
- `RC Smoothing`
- `Interpolation`
- `Filter`
- `Derivative Filter`
- `Input Filter`
- `Cutoff`
- `Anti Aliasing`
- `Loop` / `Loop Rate`
- `Gyro Sync`
- `Scheduler`

## Best Practices for Translation

1. **Preserve Acronyms:** Keep acronyms like `PID`, `OSD`, `CLI` in all locales
2. **Hybrid Phrasing:** Combine translation with preserved terms:
   - ✓ `"RP (仅增量)"` — Good
   - ✗ `"汇总RP"` — Confusing; keep RP as-is
3. **Context Translation:** Translate verbs, prepositions, and descriptive text around the English terms
4. **Consistency:** Always use the same English term the same way across all messages (e.g., always "D-Term", not "D Term" or "d-term")
5. **Vendor Names:** Keep vendor/brand/protocol names exactly as specified in official documentation (e.g., `Betaflight`, not `BetaFlight` or `betaflight`)
6. **UI Field Disambiguation:** When translating related UI fields that could be confused, use context-specific clarification:
   - Add units or type indicators: `"Freqüència VTX (MHz)"` vs `"Canal"` (clearly distinguishes frequency from channel number)
   - Use distinct terminology even for similar concepts: `"Impostacions"` (Setup) vs `"Configuració"` (Configuration)
   - Include parenthetical context when needed: `"nom (tipus)"` pattern disambiguates related fields
   - See LOCALE-MAINTENANCE.instructions.md § 3.2.E for UI Field Disambiguation rules

## Examples

### Chinese (zh_CN)
```json
{
    "pidTuningFeatheredPidsHelp": {
        "message": "Feathered PIDs 改变了 D-Term 的计算方式。0 为基于误差的 D-Term，100 为基于测量值的 D-Term..."
    }
}
```

### Catalan (ca)
```json
{
    "osdSetupUnsupportedNote2": {
        "message": "Tingueu en compte que alguns controladors de vol ja venen amb <a href=\"https://example.com\">MinimOSD</a> integrat que es pot activar i configurar amb <a href=\"https://example.com\">scarab-osd</a>..."
    }
}
```

### French (fr)
```json
{
    "receiverRcInterpolationHelp": {
        "message": "Les systèmes RC TX/RX ne sont pas aussi rapides que les boucles PID..."
    }
}
```

## Firmware Documentation Context

- **Betaflight**: Primary flight control firmware; uses consistent terminology across all documentation
- **EmuFlight**: Fork of Betaflight with extended features; maintains compatibility with Betaflight terminology
- **iNav**: Navigation-focused firmware; shares much PID/control terminology with Betaflight

All three projects expect users to understand these English technical terms, making preservation critical for cross-project compatibility and user familiarity.

## DSHOT Capitalization — Executive Summary

**Rule:** Always use `DSHOT` (all caps, no hyphens)
- **Rationale:** Aligns with de facto spec standard, improves i18n consistency, prevents translator re-capitalization errors
- **Exceptions:** None — this is UNIVERSAL across all locales
- **Encoding:** Replace any variation (`dshot`, `DShot`, `d-shot`, etc.) with `DSHOT` in any locale

## Future Validation

When adding new translations:
1. Cross-reference Betaflight Wiki: https://github.com/betaflight/betaflight/wiki
2. Check EmuFlight Documentation: https://github.com/EmuFlight/EmuFlight/wiki
3. Review iNav Docs: https://github.com/iNavFlight/inav/wiki
4. Verify terms against official ESC/hardware documentation
5. **DSHOT Check:** Ensure only `DSHOT` (all caps) appears in all locales — no case variations

---

**Last Updated:** 2026-10-09  
**Status:** Active Reference  
**Review Frequency:** Quarterly or when adding major new locales
**Critical Updates:** DSHOT standardization (2026-04-12), Failsafe terminology (2026-04-12), HEX file format added to Category 5 (2026-10-09)
