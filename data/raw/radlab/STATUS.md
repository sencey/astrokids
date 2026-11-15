# RadLab status

Working (fetched 2026-11-14T11:00:00.544Z). API: https://visualization.osdr.nasa.gov/radlab/api/ (docs at /radlab/gui/data-api/). Key-value GET syntax, format=json returns {columns,index,data}. Native rows are ~hourly (LRO, Curiosity) or ~minutely (ISS, BioSentinel) dose RATES in uGy/hour; this script averages per UTC day and multiplies by 24.

```json
[
 {
  "id": "CRaTER-D1D2",
  "days": 61,
  "baseline": "121.6",
  "peakDate": "2024-05-14",
  "peakDose": "36677",
  "peakRatio": "301.5"
 },
 {
  "id": "BPD",
  "days": 61,
  "baseline": "151.9",
  "peakDate": "2024-05-14",
  "peakDose": "9136",
  "peakRatio": "60.1"
 },
 {
  "id": "DosTel1",
  "days": 61,
  "baseline": "571.9",
  "peakDate": "2024-04-07",
  "peakDose": "743",
  "peakRatio": "1.3"
 },
 {
  "id": "DosTel2",
  "days": 61,
  "baseline": "439.3",
  "peakDate": "2024-04-07",
  "peakDose": "570",
  "peakRatio": "1.3"
 },
 {
  "id": "MSL-RAD-Surface",
  "days": 61,
  "baseline": "116.5",
  "peakDate": "2024-05-20",
  "peakDose": "1664",
  "peakRatio": "14.3"
 }
]
```
