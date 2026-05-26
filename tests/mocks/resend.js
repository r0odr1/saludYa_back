export class Resend {
  constructor() {}

  emails = {
    send: async () => ({
      data: { id: 'mock-email-id' },
      error: null,
    }),
  };
}