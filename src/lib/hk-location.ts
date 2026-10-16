import type { Lang } from "./i18n";

export interface HongKongDistrict {
  id: string;
  label: Record<Lang, string>;
  latitude: number;
  longitude: number;
}

export const HK_DISTRICTS: HongKongDistrict[] = [
  {
    id: "central_western",
    label: { "zh-CN": "中西区", "zh-Hant": "中西區", en: "Central and Western" },
    latitude: 22.2867,
    longitude: 114.154,
  },
  {
    id: "wan_chai",
    label: { "zh-CN": "湾仔区", "zh-Hant": "灣仔區", en: "Wan Chai" },
    latitude: 22.2764,
    longitude: 114.1829,
  },
  {
    id: "eastern",
    label: { "zh-CN": "东区", "zh-Hant": "東區", en: "Eastern" },
    latitude: 22.2841,
    longitude: 114.2241,
  },
  {
    id: "southern",
    label: { "zh-CN": "南区", "zh-Hant": "南區", en: "Southern" },
    latitude: 22.2473,
    longitude: 114.1588,
  },
  {
    id: "yau_tsim_mong",
    label: { "zh-CN": "油尖旺区", "zh-Hant": "油尖旺區", en: "Yau Tsim Mong" },
    latitude: 22.3189,
    longitude: 114.1722,
  },
  {
    id: "sham_shui_po",
    label: { "zh-CN": "深水埗区", "zh-Hant": "深水埗區", en: "Sham Shui Po" },
    latitude: 22.3307,
    longitude: 114.1622,
  },
  {
    id: "kowloon_city",
    label: { "zh-CN": "九龙城区", "zh-Hant": "九龍城區", en: "Kowloon City" },
    latitude: 22.3282,
    longitude: 114.1916,
  },
  {
    id: "wong_tai_sin",
    label: { "zh-CN": "黄大仙区", "zh-Hant": "黃大仙區", en: "Wong Tai Sin" },
    latitude: 22.342,
    longitude: 114.193,
  },
  {
    id: "kwun_tong",
    label: { "zh-CN": "观塘区", "zh-Hant": "觀塘區", en: "Kwun Tong" },
    latitude: 22.3133,
    longitude: 114.2258,
  },
  {
    id: "kwai_tsing",
    label: { "zh-CN": "葵青区", "zh-Hant": "葵青區", en: "Kwai Tsing" },
    latitude: 22.3549,
    longitude: 114.084,
  },
  {
    id: "tsuen_wan",
    label: { "zh-CN": "荃湾区", "zh-Hant": "荃灣區", en: "Tsuen Wan" },
    latitude: 22.3717,
    longitude: 114.1135,
  },
  {
    id: "tuen_mun",
    label: { "zh-CN": "屯门区", "zh-Hant": "屯門區", en: "Tuen Mun" },
    latitude: 22.3916,
    longitude: 113.9771,
  },
  {
    id: "yuen_long",
    label: { "zh-CN": "元朗区", "zh-Hant": "元朗區", en: "Yuen Long" },
    latitude: 22.4456,
    longitude: 114.0222,
  },
  {
    id: "north",
    label: { "zh-CN": "北区", "zh-Hant": "北區", en: "North" },
    latitude: 22.4947,
    longitude: 114.1381,
  },
  {
    id: "tai_po",
    label: { "zh-CN": "大埔区", "zh-Hant": "大埔區", en: "Tai Po" },
    latitude: 22.45,
    longitude: 114.1694,
  },
  {
    id: "sha_tin",
    label: { "zh-CN": "沙田区", "zh-Hant": "沙田區", en: "Sha Tin" },
    latitude: 22.3871,
    longitude: 114.1953,
  },
  {
    id: "sai_kung",
    label: { "zh-CN": "西贡区", "zh-Hant": "西貢區", en: "Sai Kung" },
    latitude: 22.3814,
    longitude: 114.2705,
  },
  {
    id: "islands",
    label: { "zh-CN": "离岛区", "zh-Hant": "離島區", en: "Islands" },
    latitude: 22.262,
    longitude: 113.946,
  },
];

export function districtById(id: string): HongKongDistrict | undefined {
  return HK_DISTRICTS.find((district) => district.id === id);
}

export function districtIdFromLabel(label: string): string {
  const normalized = label.trim().toLocaleLowerCase();
  return (
    HK_DISTRICTS.find((district) =>
      Object.values(district.label).some((value) => value.toLocaleLowerCase() === normalized),
    )?.id ?? ""
  );
}

export function approximateCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function nearestHongKongDistrict(
  latitude: number,
  longitude: number,
): HongKongDistrict | null {
  if (latitude < 22.15 || latitude > 22.58 || longitude < 113.8 || longitude > 114.5) {
    return null;
  }

  return HK_DISTRICTS.reduce(
    (nearest, district) => {
      const latitudeDelta = district.latitude - latitude;
      const longitudeDelta =
        (district.longitude - longitude) * Math.cos((latitude * Math.PI) / 180);
      const distance = latitudeDelta ** 2 + longitudeDelta ** 2;
      return distance < nearest.distance ? { district, distance } : nearest;
    },
    { district: HK_DISTRICTS[0], distance: Number.POSITIVE_INFINITY },
  ).district;
}
