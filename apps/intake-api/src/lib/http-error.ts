/** 상태코드를 들고 다니는 에러. 서비스에서 throw, 라우트에서 잡아 { error } 로 응답. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
