import ApiError from "../utils/ApiError.js";

const notFound = (req, res, next) => {
  next(new ApiError(404, `Endpoint not found - ${req.originalUrl}`));
};

export default notFound;
