export const TECHNOLOGIES = {
  ashp: "Air Source Heat Pump",
  battery: "Battery Storage",
  biomass: "Biomass",
  eahp: "Exhaust Air Heat Pump",
  gahp: "Gas Absorption Heat Pump",
  gshp: "Ground Source Heat Pump",
  hydro: "Hydro",
  micro_chp: "Micro CHP",
  sahp: "Solar Assisted Heat Pump",
  solar_pv: "Solar PV",
  solar_thermal: "Solar Thermal",
  wind_turbine: "Small Wind Turbine",
  wshp: "Water Source Heat Pump",
} as const;

export const REGIONS = {
  east_midlands: "East Midlands",
  eastern: "Eastern",
  london: "London",
  north_east: "North East",
  north_west: "North West",
  northern_ireland: "Northern Ireland",
  scotland: "Scotland",
  south_east: "South East",
  south_west: "South West",
  wales: "Wales",
  west_midlands: "West Midlands",
  yorkshire_humberside: "Yorkshire & Humberside",
} as const;

export type TechnologyKey = keyof typeof TECHNOLOGIES;
export type RegionKey = keyof typeof REGIONS;

export interface Installer {
  id: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string[];
  county: string;
  postcode: string;
  country: string;
  certNumber: string;
  certBody: string;
  boilerUpgradeScheme: boolean;
  subType: string;
  lat: number | null;
  lng: number | null;
  technologies: TechnologyKey[];
  regions: RegionKey[];
}

export interface InstallersMeta {
  updatedAt: string;
  count: number;
  reportedTotal: number;
  pagesFetched: number;
  duplicatesSeen: number;
  missingCoords: number;
}

export interface InstallerWithDistance extends Installer {
  distance: number | null;
}
