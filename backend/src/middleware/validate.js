const AppError = require("../utils/AppError");

// validate(joiSchema) checks req.body and replaces it with the sanitised value.
const validate = (schema) => (req, _res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) throw new AppError(400, error.details.map((d) => d.message.replace(/"/g, "")).join(", "));
  req.body = value;
  next();
};

module.exports = validate;
