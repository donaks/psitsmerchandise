"use client";

import { useEffect, useState } from "react";

type Place = { code: string; name: string };
type Prefix = "billing" | "shipping";

const API = "https://psgc.gitlab.io/api";

async function getPlaces(path: string): Promise<Place[]> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error("Location list unavailable");
  const data = await response.json() as Array<{ code?: string; name?: string }>;
  return data
    .filter((item): item is Place => Boolean(item.code && item.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function AddressSelector({ prefix, legend }: { prefix: Prefix; legend: string }) {
  const [provinces, setProvinces] = useState<Place[]>([]);
  const [cities, setCities] = useState<Place[]>([]);
  const [barangays, setBarangays] = useState<Place[]>([]);
  const [provinceCode, setProvinceCode] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [provinceName, setProvinceName] = useState("");
  const [cityName, setCityName] = useState("");
  const [barangayName, setBarangayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    getPlaces("/provinces/")
      .then(setProvinces)
      .catch(() => setManual(true))
      .finally(() => setLoading(false));
  }, []);

  async function chooseProvince(code: string) {
    const item = provinces.find(place => place.code === code);
    setProvinceCode(code); setProvinceName(item?.name ?? "");
    setCityCode(""); setCityName(""); setBarangayName(""); setCities([]); setBarangays([]);
    if (!code) return;
    try { setCities(await getPlaces(`/provinces/${code}/cities-municipalities/`)); }
    catch { setManual(true); }
  }

  async function chooseCity(code: string) {
    const item = cities.find(place => place.code === code);
    setCityCode(code); setCityName(item?.name ?? ""); setBarangayName(""); setBarangays([]);
    if (!code) return;
    try { setBarangays(await getPlaces(`/cities-municipalities/${code}/barangays/`)); }
    catch { setManual(true); }
  }

  return <fieldset className="addressGroup">
    <legend>{legend}</legend>
    <label>House no. / Street<input name={`${prefix}Line1`} required minLength={2} maxLength={160} placeholder="House no., building, street" /></label>
    {manual ? <>
      <div className="addressGrid">
        <label>Province<input name={`${prefix}Province`} required minLength={2} maxLength={160} /></label>
        <label>City / Municipality<input name={`${prefix}City`} required minLength={2} maxLength={160} /></label>
        <label>Barangay<input name={`${prefix}Barangay`} required minLength={2} maxLength={160} /></label>
        <label>Postal code<input name={`${prefix}PostalCode`} required minLength={4} maxLength={4} pattern="[0-9]{4}" inputMode="numeric" /></label>
      </div>
      <p className="locationHint">Location lists are unavailable right now. Enter the address manually.</p>
    </> : <>
      <input type="hidden" name={`${prefix}Province`} value={provinceName} />
      <input type="hidden" name={`${prefix}City`} value={cityName} />
      <div className="addressGrid">
        <label>Province<select required value={provinceCode} disabled={loading} onChange={event => void chooseProvince(event.target.value)}>
          <option value="">{loading ? "Loading provinces…" : "Select province"}</option>
          {provinces.map(place => <option key={place.code} value={place.code}>{place.name}</option>)}
        </select></label>
        <label>City / Municipality<select required value={cityCode} disabled={!provinceCode} onChange={event => void chooseCity(event.target.value)}>
          <option value="">{provinceCode ? "Select city / municipality" : "Select province first"}</option>
          {cities.map(place => <option key={place.code} value={place.code}>{place.name}</option>)}
        </select></label>
        <label>Barangay<select name={`${prefix}Barangay`} required value={barangayName} disabled={!cityCode} onChange={event => setBarangayName(event.target.value)}>
          <option value="">{cityCode ? "Select barangay" : "Select city first"}</option>
          {barangays.map(place => <option key={place.code} value={place.name}>{place.name}</option>)}
        </select></label>
        <label>Postal code<input name={`${prefix}PostalCode`} required minLength={4} maxLength={4} pattern="[0-9]{4}" inputMode="numeric" placeholder="0000" /></label>
      </div>
      <button className="manualAddress" type="button" onClick={() => setManual(true)}>Can’t find your address? Enter it manually</button>
    </>}
  </fieldset>;
}
