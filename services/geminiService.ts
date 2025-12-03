import { GoogleGenAI, Type } from "@google/genai";
import { Stop } from "../types";

// Initialize Gemini Client
// NOTE: We assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini to convert a location name into approximate coordinates.
 * This is useful for general cities, landmarks, etc.
 */
export const geocodeLocation = async (locationName: string): Promise<{ lat: number; lng: number; formattedName: string } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide the latitude and longitude for: "${locationName}". Also provide a pretty formatted name for it.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER, description: "Latitude of the location" },
            lng: { type: Type.NUMBER, description: "Longitude of the location" },
            formattedName: { type: Type.STRING, description: "Correctly capitalized and formatted name of the place" },
            found: { type: Type.BOOLEAN, description: "Whether the location was found/valid" }
          },
          required: ["lat", "lng", "formattedName", "found"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    // Explicitly check for number type and finite value to avoid NaN errors
    if (
        data.found && 
        typeof data.lat === 'number' && Number.isFinite(data.lat) && 
        typeof data.lng === 'number' && Number.isFinite(data.lng)
    ) {
      return { lat: data.lat, lng: data.lng, formattedName: data.formattedName };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

/**
 * Optimizes the delivery route using Gemini (solving a simple TSP).
 */
export const optimizeRoute = async (stops: Stop[]): Promise<string[]> => {
  if (stops.length <= 1) return stops.map(s => s.id);

  try {
    const stopsList = stops.map(s => ({ id: s.id, name: s.name, coords: s.coordinates }));
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `I have a list of locations for Santa to visit starting from the North Pole (approx lat 85, lng 0). 
      Reorder these stops to minimize the total travel distance. 
      Return ONLY the list of IDs in the optimized order.
      
      Stops: ${JSON.stringify(stopsList)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedOrder: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of Stop IDs in the visited order"
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.optimizedOrder || stops.map(s => s.id);
  } catch (error) {
    console.error("Optimization error:", error);
    return stops.map(s => s.id); // Fallback to original order
  }
};

/**
 * Generates a fun Christmas-themed status message based on the location and present.
 */
export const generateArrivalMessage = async (location: string, present: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a very short, witty one-sentence status update for Santa arriving at ${location} to deliver ${present}. Use emojis.`,
            config: {
                // Removed maxOutputTokens to avoid conflict with potential thinking budget usage
                temperature: 0.9
            }
        });
        return response.text || `Santa has arrived at ${location}!`;
    } catch (e) {
        return `Santa has arrived at ${location}!`;
    }
}

/**
 * Generates an image of Santa delivering the gift at the location.
 */
export const generateDeliveryImage = async (location: string, present: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { text: `A vibrant, festive cartoon illustration of Santa Claus delivering a ${present} to a home in ${location}. Winter night scene, snowy, magical sparkles, warm window lights. High quality.` }
        ]
      }
    });

    // Iterate through parts to find the image data
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
};