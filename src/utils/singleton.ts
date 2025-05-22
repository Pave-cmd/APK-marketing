/**
 * Abstract Singleton class to provide a consistent implementation pattern
 * for service singletons across the application
 */
export abstract class Singleton {
  protected static instances: Record<string, any> = {};

  /**
   * Constructor to allow inheritance
   * Note: We're making this public to avoid TypeScript errors with classes that extend it
   */
  constructor() {
    // Initialization can go here
  }

  /**
   * Generic getInstance method that uses the class name as the key
   * @returns The singleton instance of the class
   */
  public static getInstance<T extends Singleton>(this: new () => T): T {
    const className = this.name;
    
    if (!Singleton.instances[className]) {
      Singleton.instances[className] = new this();
    }
    
    return Singleton.instances[className] as T;
  }
}