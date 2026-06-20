# Changelog

All notable changes to FanDock will be documented in this file.

## [0.2.0] - 2026-06-20

### Added
- Dashboard fan widget: speedometer-style gauge with rotating fan icon
- Fan rotation speed proportional to RPM with smooth deceleration on stop
- Session timeout after 5 minutes of inactivity with automatic token refresh while active
- Hardware change detection: modal notification when disks are added or removed
- "Review changes" option in hardware change modal relaunches pre-filled setup wizard
- "Re-run setup wizard" button in Settings
- French and German translations

### Changed
- i18n system migrated from JS objects to JSON files — new languages only require a JSON file PR
- Language auto-detected from browser, overridable in Settings
- Toggle contrast improved in light mode
- Fan widget replaces horizontal progress bars in dashboard

### Fixed
- Hardcoded UI strings moved to translation keys (fan stopped state, threshold tooltips)
- Wizard fan name scrambling when some fans are unmonitored — now uses allFans consistently
- Session persists correctly while user is active


## [0.1.1] - 2026-06-15

### Added
- Full i18n system — all UI strings are now translatable
- English, Spanish, French and German translations included
- New languages are detected automatically — contributing a translation only requires adding a JSON file and opening a PR
- Language preference saved per user, with browser language as default
- TrueNAS SCALE Community Edition installation guide in README
- Screenshots (Dashboard, Curves, Settings) in README
- "Adding a language" contributor guide in README

### Changed
- All hardcoded UI strings moved to translation keys
- Settings now show full language names instead of country codes

## [0.1.0] - 2026-06-10

### Added
- Per-fan linked disks — each fan curve reacts to selected disk temps
- Fan hardware diagnostic panel with kernel module instructions
- Improved fan test: stop → wait → spin at 100% to identify fans physically
- Reset configuration option (keeps password, relaunches wizard)
- Persistent onboarding banner dismiss
- Footer with GitHub and issue report links
- Version display in topbar and footer
- GitHub Actions CI/CD — auto-build and push to Docker Hub on every commit
- lm-sensors included in Docker image
- Responsive layout for mobile devices

### Fixed
- Fan IDs now match chip numbering (fan1-fan7)
- Disk names use serial number as stable key (survives reboots)
- Last curve point always forced to 100%
- Curve points clamped between adjacent points (no mountain-shape curves)
- zvol devices filtered from disk scan
- PWM control released to BIOS on app shutdown
- Fan control loop paused during fan test
- Immediate dashboard refresh after saving settings
- Curve editor shows only controlled fans
- Settings fan RPM auto-refreshes every 5 seconds

## [0.0.1] - 2026-06-04

### Added
- Initial release (alpha)
- Dashboard with disk temperatures (HDD/SSD/NVMe auto-detected)
- Fan status monitoring with RPM display
- Fan curve editor with drag-to-edit support
- Settings: hardware auto-scan, friendly names, PWM mapping
- Fan Test button (wizard and settings)
- Login / logout / password change
- First-run wizard for hardware identification
- Monitor and Control toggles per disk and fan
- Docker single-container deployment