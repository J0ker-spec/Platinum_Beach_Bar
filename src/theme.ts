export const APP_NAME = "PlatinumX";
export const BUSINESS_NAME = "Platinum Beach";
export const WORKPLACE_ADDRESS = "14 Harbour Street";

export const colors = {
  primary: "#4F63E9",
  primaryDark: "#3647BD",
  secondary: "#8061D9",
  lavender: "#F0ECFF",
  paleBlue: "#EEF2FF",
  background: "#F7F8FC",
  card: "#FFFFFF",
  surface: "#F1F2FA",
  lavenderSurface: "#F6F2FF",
  border: "#E7E9F2",
  text: "#191C2E",
  textSecondary: "#686F83",
  muted: "#9298AA",
  disabled: "#B5B9C7",
  onPrimary: "#FFFFFF",
  amber: "#F59E0B",
  success: "#159A70",
  warning: "#D99016",
  error: "#DC4C58",
  info: "#3778D6",
  successSoft: "#E7F6F0",
  warningSoft: "#FFF6E5",
  errorSoft: "#FDECEE",
  overlay: "rgba(25, 28, 46, 0.45)",
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  chip: 10,
  input: 14,
  card: 18,
  sheet: 24,
  pill: 999,
};

export const type = {
  hero: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  section: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  card: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: "500" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: "600" as const },
};

export const shadow = {
  card: {
    shadowColor: "#191C2E",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  float: {
    shadowColor: "#3647BD",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};
