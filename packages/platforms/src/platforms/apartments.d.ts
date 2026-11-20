export interface ApartmentRental {
  RentalKey: string;
  RentalType: number;
  ModelKey: string;
  Beds: number;
  Baths: number;
  Rent: number;
  MaxRent: number;
  SquareFeet: number;
  MaxSquareFeet: number;
  UnitNumber?: string;
  Name: string;
  Description: string;
  AvailableDateText: string;
  ImageUri?: string;
  HasUnitPhoto: boolean;
  InteriorAmenities?: {
    SubCategories: { Amenities: { Name: string }[] }[];
  };
}

export interface ApartmentMeta {
  location: string;
  details: string[];
  amenities: string[];
  features: string[];
  pets: string;
  parking: string;
  propertyPhotos: boolean;
}

export interface ApartmentData {
  url: string;
  name: string;
  location: string;
  description: string;
  minRent: number;
  maxRent: number;
  rentals: ApartmentRental[];
  rental?: ApartmentRental;
  media: { url: string; type: string; description?: string }[];
  amenities: string[];
  features: string[];
  pets: string;
  parking: string;
}
