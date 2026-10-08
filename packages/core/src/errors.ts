export class CoreError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "INVALID" | "RATE_LIMITED",
    message: string
  ) {
    super(message);
    this.name = "CoreError";
  }
  get httpStatus(): number {
    switch (this.code) {
      case "NOT_FOUND":
        return 404;
      case "CONFLICT":
        return 409;
      case "RATE_LIMITED":
        return 429;
      case "FORBIDDEN":
        return 403;
      default:
        return 400;
    }
  }
}
