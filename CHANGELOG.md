# Changelog

All notable changes to FanDock will be documented in this file.

## [0.0.1] - 2026-06-04

### Added
- Initial release (alpha)
- Dashboard with disk temperatures (HDD/SSD/NVMe auto-detected)
- Fan status monitoring with RPM display
- Fan curve editor with drag-to-edit support
- Per-fan linked disks — each fan curve reacts to selected disk temps
- Settings: hardware auto-scan, friendly names, PWM mapping
- Fan Test button (wizard and settings)
- Login / logout / password change
- First-run wizard for hardware identification
- Monitor and Control toggles per disk and fan
- PWM control released to BIOS on app shutdown
- Docker single-container deployment

### Fixed
- Fan IDs now match chip numbering (fan1-fan7)
- Disk names use serial number as stable key
- Last curve point always forced to 100%
- Curve points enforce monotonically increasing PWM values
- zvol devices filtered from disk scan