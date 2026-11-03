// An id becomes part of a file name, so anything else, like "../.env.local",
// is refused before it gets near the disk. The server uses the same check.
// It lives in its own file so the server can use it without pulling in the
// file-saving code, which would make the build ship the whole project.
export const RUN_ID_PATTERN = /^run_[0-9a-f]{8}$/;
