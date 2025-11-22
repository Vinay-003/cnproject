/**
 * AQI Calculator based on research paper ranges
 * Reference: "IoT Based Design of Air Quality Monitoring System Web Server for Android Platform"
 * By Koel Datta Purkayastha et al., 2021
 */

export interface AQIRange {
  label: string;
  color: string;
  minAQI: number;
  maxAQI: number;
}

export interface PollutantRanges {
  co: { min: number; max: number }; // ppm
  co2: { min: number; max: number }; // ppm
  no2: { min: number; max: number }; // ppm
}

// AQI Categories as per paper Table 2
export const AQI_RANGES: AQIRange[] = [
  { label: 'Good', color: '#2ecc71', minAQI: 0, maxAQI: 50 },
  { label: 'Satisfactory', color: '#27ae60', minAQI: 51, maxAQI: 100 },
  { label: 'Moderate', color: '#f1c40f', minAQI: 101, maxAQI: 150 },
  { label: 'Poor', color: '#e67e22', minAQI: 151, maxAQI: 200 },
  { label: 'Very Poor', color: '#e74c3c', minAQI: 201, maxAQI: 300 },
  { label: 'Severe', color: '#8e44ad', minAQI: 301, maxAQI: 500 },
];

// Pollutant concentration ranges as per paper Table 2
export const POLLUTANT_RANGES: { [key: string]: PollutantRanges[] } = {
  ranges: [
    // Good
    { co: { min: 0, max: 0.87 }, co2: { min: 0, max: 350 }, no2: { min: 0, max: 0.021 } },
    // Satisfactory
    { co: { min: 0.88, max: 1.75 }, co2: { min: 351, max: 450 }, no2: { min: 0.022, max: 0.042 } },
    // Moderate
    { co: { min: 1.76, max: 8.73 }, co2: { min: 451, max: 600 }, no2: { min: 0.043, max: 0.095 } },
    // Poor
    { co: { min: 8.74, max: 14.85 }, co2: { min: 601, max: 1000 }, no2: { min: 0.096, max: 0.149 } },
    // Very Poor
    { co: { min: 14.86, max: 29.7 }, co2: { min: 1001, max: 2500 }, no2: { min: 0.150, max: 0.213 } },
    // Severe
    { co: { min: 29.8, max: 100 }, co2: { min: 2501, max: 5000 }, no2: { min: 0.214, max: 1.0 } },
  ]
};

/**
 * Calculate AQI category from concentration value
 */
function calculateSubIndex(concentration: number, ranges: { min: number; max: number }[], categoryIndex: number): number {
  const category = AQI_RANGES[categoryIndex];
  const range = ranges[categoryIndex];
  
  if (concentration < range.min) {
    // If below this category, check previous
    if (categoryIndex > 0) {
      return calculateSubIndex(concentration, ranges, categoryIndex - 1);
    }
    return category.minAQI;
  }
  
  if (concentration > range.max) {
    // If above this category, check next
    if (categoryIndex < ranges.length - 1) {
      return calculateSubIndex(concentration, ranges, categoryIndex + 1);
    }
    return category.maxAQI;
  }
  
  // Linear interpolation within category
  const concentrationRange = range.max - range.min;
  const aqiRange = category.maxAQI - category.minAQI;
  const ratio = (concentration - range.min) / concentrationRange;
  return category.minAQI + (ratio * aqiRange);
}

/**
 * Calculate individual AQI for each pollutant
 */
export function calculatePollutantAQI(co: number, co2: number, no2: number): {
  coAQI: number;
  co2AQI: number;
  no2AQI: number;
  overallAQI: number;
  dominant: 'CO' | 'CO2' | 'NO2';
} {
  const ranges = POLLUTANT_RANGES.ranges;
  
  // Extract ranges for each pollutant
  const coRanges = ranges.map(r => r.co);
  const co2Ranges = ranges.map(r => r.co2);
  const no2Ranges = ranges.map(r => r.no2);
  
  // Calculate sub-indices
  const coAQI = calculateSubIndex(co, coRanges, 0);
  const co2AQI = calculateSubIndex(co2, co2Ranges, 0);
  const no2AQI = calculateSubIndex(no2, no2Ranges, 0);
  
  // Overall AQI is the maximum of all sub-indices
  const overallAQI = Math.max(coAQI, co2AQI, no2AQI);
  
  // Determine dominant pollutant
  let dominant: 'CO' | 'CO2' | 'NO2' = 'CO2';
  if (coAQI === overallAQI) dominant = 'CO';
  else if (no2AQI === overallAQI) dominant = 'NO2';
  
  return {
    coAQI: Math.round(coAQI),
    co2AQI: Math.round(co2AQI),
    no2AQI: Math.round(no2AQI),
    overallAQI: Math.round(overallAQI),
    dominant,
  };
}

/**
 * Get AQI status from AQI value
 */
export function getAQIStatus(aqi?: number): { label: string; color: string; description: string } {
  if (aqi == null || isNaN(aqi)) {
    return { label: 'Unknown', color: '#9E9E9E', description: 'No data available' };
  }
  
  for (const range of AQI_RANGES) {
    if (aqi >= range.minAQI && aqi <= range.maxAQI) {
      let description = '';
      switch (range.label) {
        case 'Good':
          description = 'Air quality is satisfactory, and air pollution poses little or no risk.';
          break;
        case 'Satisfactory':
          description = 'Air quality is acceptable for most people.';
          break;
        case 'Moderate':
          description = 'Members of sensitive groups may experience health effects.';
          break;
        case 'Poor':
          description = 'Everyone may begin to experience health effects.';
          break;
        case 'Very Poor':
          description = 'Health alert: everyone may experience more serious health effects.';
          break;
        case 'Severe':
          description = 'Health warnings of emergency conditions. The entire population is likely to be affected.';
          break;
      }
      return { label: range.label, color: range.color, description };
    }
  }
  
  // If above all ranges
  return { 
    label: 'Hazardous', 
    color: '#7f0000', 
    description: 'Health warnings of emergency conditions. Everyone is more likely to be affected.' 
  };
}

/**
 * Get pollutant category
 */
export function getPollutantCategory(pollutant: 'CO' | 'CO2' | 'NO2', value: number): {
  category: string;
  color: string;
  inRange: boolean;
} {
  const ranges = POLLUTANT_RANGES.ranges;
  
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const aqiRange = AQI_RANGES[i];
    
    let pollutantRange: { min: number; max: number };
    switch (pollutant) {
      case 'CO':
        pollutantRange = range.co;
        break;
      case 'CO2':
        pollutantRange = range.co2;
        break;
      case 'NO2':
        pollutantRange = range.no2;
        break;
    }
    
    if (value >= pollutantRange.min && value <= pollutantRange.max) {
      return {
        category: aqiRange.label,
        color: aqiRange.color,
        inRange: true,
      };
    }
  }
  
  // Out of range
  return {
    category: 'Out of Range',
    color: '#9E9E9E',
    inRange: false,
  };
}
