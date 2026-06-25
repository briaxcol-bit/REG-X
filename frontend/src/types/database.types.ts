export interface Database {
  public: {
    Tables: {
      [key: string]: any;
    };
    Views: {
      [key: string]: any;
    };
    Functions: {
      [key: string]: any;
    };
  };
}
