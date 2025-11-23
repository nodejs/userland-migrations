function example(response, request) {
  const all = response._headers;
  const ct = response._headers["content-type"];
  if ("content-length" in response._headers) console.log("has length");
  console.log(Object.keys(response._headers));
  console.log(response._headerNames);

  const allReq = request._headers;
  const ua = request._headers['user-agent'];
  if ('accept' in request._headers) console.log('has accept');
  console.log(Object.keys(request._headers));
  console.log(request._headerNames);
}
