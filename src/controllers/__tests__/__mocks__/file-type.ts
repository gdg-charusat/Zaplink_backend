// Mock for file-type module used in tests
export const fileTypeFromBuffer = jest.fn(() => 
  Promise.resolve({ ext: "txt", mime: "text/plain" })
);
