function example(response, request) {
  const all = response.getHeaders();
  const ct = response.getHeader("content-type");
  if (response.hasHeader("content-length")) console.log("has length");
  console.log(response.getHeaderNames());
  console.log(response.getHeaderNames());

  const allReq = request.getHeaders();
  const ua = request.getHeader('user-agent');
  if (request.hasHeader('accept')) console.log('has accept');
  console.log(request.getHeaderNames());
  console.log(request.getHeaderNames());
}
