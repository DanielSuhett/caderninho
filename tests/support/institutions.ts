// Imports that do not exercise bank identification use an empty catalog.
export const noInstitutions = {
  institutions: {
    find: async () => null,
    list: async () => [],
  },
  reportInstitution: () => undefined,
};
