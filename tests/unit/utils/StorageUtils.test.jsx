import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getStoredData,
  setStoredData,
  removeStoredData,
} from "@/utils/StorageUtils";

describe("StorageUtils", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    vi.clearAllMocks();
    global.localStorage.getItem.mockClear();
    global.localStorage.setItem.mockClear();
    global.localStorage.removeItem.mockClear();
  });

  describe("getStoredData", () => {
    it("should retrieve and parse stored data", () => {
      const testData = { key: "value" };
      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testData));

      const result = getStoredData("test-key", {});

      expect(result).toEqual(testData);
      expect(global.localStorage.getItem).toHaveBeenCalledWith("test-key");
    });

    it("should return default value if no data stored", () => {
      global.localStorage.getItem.mockReturnValueOnce(null);

      const defaultValue = { default: true };
      const result = getStoredData("test-key", defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it("should return default value if stored value is empty string", () => {
      global.localStorage.getItem.mockReturnValueOnce("");

      const defaultValue = "default";
      const result = getStoredData("test-key", defaultValue);

      expect(result).toBe(defaultValue);
    });

    it("should handle JSON parse errors gracefully", () => {
      global.localStorage.getItem.mockReturnValueOnce("invalid json");

      const defaultValue = { default: true };
      const result = getStoredData("test-key", defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it("should parse numbers correctly", () => {
      global.localStorage.getItem.mockReturnValueOnce("42");

      const result = getStoredData("test-key", 0);

      expect(result).toBe(42);
      expect(typeof result).toBe("number");
    });

    it("should parse booleans correctly", () => {
      global.localStorage.getItem.mockReturnValueOnce("true");

      const result = getStoredData("test-key", false);

      expect(result).toBe(true);
      expect(typeof result).toBe("boolean");
    });

    it("should parse arrays correctly", () => {
      const testArray = [1, 2, 3];
      global.localStorage.getItem.mockReturnValueOnce(
        JSON.stringify(testArray),
      );

      const result = getStoredData("test-key", []);

      expect(result).toEqual(testArray);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should parse complex objects correctly", () => {
      const complexObject = {
        nested: { value: 123 },
        array: [1, 2, 3],
        string: "test",
      };
      global.localStorage.getItem.mockReturnValueOnce(
        JSON.stringify(complexObject),
      );

      const result = getStoredData("test-key", {});

      expect(result).toEqual(complexObject);
    });

    it("should handle null stored data", () => {
      global.localStorage.getItem.mockReturnValueOnce(null);

      const result = getStoredData("test-key", "default");

      expect(result).toBe("default");
    });
  });

  describe("setStoredData", () => {
    it("should stringify and store data", () => {
      const testData = { key: "value" };

      setStoredData("test-key", testData);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify(testData),
      );
    });

    it("should handle string values", () => {
      const testValue = "test string";

      setStoredData("test-key", testValue);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify(testValue),
      );
    });

    it("should handle number values", () => {
      const testValue = 42;

      setStoredData("test-key", testValue);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        "test-key",
        "42",
      );
    });

    it("should handle null values", () => {
      setStoredData("test-key", null);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        "test-key",
        "null",
      );
    });

    it("should handle array values", () => {
      const testArray = [1, 2, 3];

      setStoredData("test-key", testArray);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        "test-key",
        "[1,2,3]",
      );
    });

    it("should handle storage errors gracefully", () => {
      global.localStorage.setItem.mockImplementationOnce(() => {
        throw new Error("Storage quota exceeded");
      });

      expect(() => setStoredData("test-key", { data: "test" })).not.toThrow();
    });

    it("should stringify complex objects correctly", () => {
      const complexObject = {
        nested: { value: 123 },
        array: [1, 2, 3],
      };

      setStoredData("test-key", complexObject);

      const stored = JSON.parse(global.localStorage.setItem.mock.calls[0][1]);
      expect(stored).toEqual(complexObject);
    });
  });

  describe("removeStoredData", () => {
    it("should remove data from storage", () => {
      removeStoredData("test-key");

      expect(global.localStorage.removeItem).toHaveBeenCalledWith("test-key");
    });

    it("should handle removal errors gracefully", () => {
      global.localStorage.removeItem.mockImplementationOnce(() => {
        throw new Error("Remove error");
      });

      expect(() => removeStoredData("test-key")).not.toThrow();
    });

    it("should handle multiple removals", () => {
      removeStoredData("key1");
      removeStoredData("key2");
      removeStoredData("key3");

      expect(global.localStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(global.localStorage.removeItem).toHaveBeenNthCalledWith(1, "key1");
      expect(global.localStorage.removeItem).toHaveBeenNthCalledWith(2, "key2");
      expect(global.localStorage.removeItem).toHaveBeenNthCalledWith(3, "key3");
    });
  });

  describe("integration scenarios", () => {
    it("should store and retrieve data correctly", () => {
      const testData = { user: "test", score: 100 };

      setStoredData("game-state", testData);

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testData));
      const retrieved = getStoredData("game-state", {});

      expect(retrieved).toEqual(testData);
    });

    it("should handle update cycle", () => {
      const data1 = { score: 100 };
      const data2 = { score: 200 };

      setStoredData("score", data1);

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(data1));
      const retrieved1 = getStoredData("score", {});

      expect(retrieved1).toEqual(data1);

      setStoredData("score", data2);

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(data2));
      const retrieved2 = getStoredData("score", {});

      expect(retrieved2).toEqual(data2);
    });

    it("should handle remove and default cycle", () => {
      const testData = { value: "test" };

      setStoredData("temp-data", testData);
      removeStoredData("temp-data");

      global.localStorage.getItem.mockReturnValueOnce(null);
      const retrieved = getStoredData("temp-data", { default: true });

      expect(retrieved).toEqual({ default: true });
    });

    it("should preserve data types through storage cycle", () => {
      const original = {
        string: "text",
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        null: null,
        nested: { value: 123 },
      };

      setStoredData("complex", original);

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(original));
      const retrieved = getStoredData("complex", {});

      expect(retrieved).toEqual(original);
      expect(typeof retrieved.string).toBe("string");
      expect(typeof retrieved.number).toBe("number");
      expect(typeof retrieved.boolean).toBe("boolean");
      expect(Array.isArray(retrieved.array)).toBe(true);
      expect(retrieved.null).toBeNull();
    });
  });
});
