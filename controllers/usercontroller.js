import { register } from "../models/user.js";
import bycrypt from "bcryptjs";
import { sendcookie } from "../utils/features.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import { errorHandler } from "../middleware/error.js";
import jwt from "jsonwebtoken";
import { Apifeature } from "../utils/apifeature.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import { isAuthenticate } from "../middleware/auth.js";

// registration
export const userRegister = catchAsyncError(async (req, res, next) => {
  const {
    firstname,
    lastname,
    companyname,
    phoneNo,
    username,
    password,
    category,
    city,
    state,
    address,
    email,
    website,
  } = req.body;

  let user = await register.findOne({ email });

  if (user) return next(new errorHandler("User already exists", 409));

  let checkNum = await register.findOne({ phoneNo });

  if (checkNum) return next(new errorHandler("User already exists", 409));

  const hashpwd = await bycrypt.hash(password, 10);

  user = await register.create({
    firstname,
    lastname,
    companyname,
    phoneNo,
    username,
    password: hashpwd,
    category,
    city,
    state,
    address,
    email,
    website,
  });

  sendcookie(user, res, 201, "Register successfully");
});

// login
export const userLogin = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  let user = await register.findOne({ email }).select("+password");
  console.log(user);

  if (!user) next(new errorHandler("Invalid Email or Password ", 400));

  const isMatch = await bycrypt.compare(password, user.password);

  if (!isMatch) next(new errorHandler("Invalid Email or Password ", 400));

  // console.log(user._id);
  sendcookie(user, res, 200, `welcome back, ${user.firstname}`);
});

// get profile
export const myProfile = catchAsyncError((req, res, next) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

// logout
export const logout = catchAsyncError((req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "Development" ? "lax" : "none",
      secure: process.env.NODE_ENV === "Development" ? false : true,
    })
    .json({
      success: true,
      user: req.user,
    });
});

// Get all users(admin)
export const getAllUser = catchAsyncError(async (req, res, next) => {
  const users = await register.find();

  res.status(200).json({
    success: true,
    users,
  });
});

//  get all unapprove user --admin
export const getallnewusers = catchAsyncError(async (req, res, next) => {
  const user = await register.find({ status: "false" });

  res.json({
    success: "ture",
    user,
  });
});

// Get single user (admin)
export const getSingleUser = catchAsyncError(async (req, res, next) => {
  const user = await register.findById(req.params.id);

  if (!user) {
    return next(
      new errorHandler(`User does not exist with Id: ${req.params.id}`)
    );
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// Delete User --Admin
export const deleteUser = catchAsyncError(async (req, res, next) => {
  const user = await register.findById(req.params.id);
  console.log(req.params.id);
  console.log(user);

  if (!user)
    return next(
      new errorHandler(`User does not exist with Id: ${req.params.id}`, 400)
    );

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});

// approveUser by admin  --admin
export const updateUserStatus = catchAsyncError(async (req, res, next) => {
  const user = await register.findById(req.params.id);
  console.log(req.params.id);
  console.log(user);

  if (!user)
    return next(
      new errorHandler(`User does not exist with Id: ${req.params.id}`, 400)
    );

  if (user.status == false) {
    user.status = "true";
  } else {
    user.status = "false";
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: "status updated",
  });
});

//2. all approved user
export const getApprovedUsers = catchAsyncError(async (req, res, next) => {
  const user = await register.find({ status: "true" });

  res.json({
    success: "ture",
    user,
  });
});

//update profile
export const updateUserProfile = catchAsyncError(async (req, res, next) => {
  const newUserData = {
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    companyname: req.body.companyname,
    phoneNo: req.body.phoneNo,
    username: req.body.username,
    category: req.body.category,
    city: req.body.city,
    state: req.body.state,
    address: req.body.address,
    email: req.body.email,
    website: req.body.website,
  };

  const user = await register.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
    message: "updated Successfully",
    user,
  });
});

// get all user --search side
export const getUsers = catchAsyncError(async (req, res, next) => {
  const apifeature = new Apifeature(
    register.find({ status: "true" }),
    req.query
  )
    .search()
    .filter();
  const user = await apifeature.query;

  res.json({
    success: "ture",
    user,
  });
});

//forgatePassword
export const forgetPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  const user = await register.findOne({ email });
  if (!user) res.status(400).send("User not found");
  // console.log(user);

  //generate Token
  const resetToken = await user.getResetToken();
  await user.save();
  // console.log(resetToken);

  const url = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
  console.log(url);

  const msg = `Click on link to reset password. ${url}.`;

  //send token in mail
  sendEmail(user.email, msg, "wall Clock Zone ResetPassword");

  res
    .status(200)
    .json({ success: true, msg: `Reset token has send to ${user.email}` });
});

//resetPassword
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  console.log(token);

  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  console.log(resetPasswordToken);
  const user = await register.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) return next(new errorHandler("Invalid token or it is expired"));

  // if (user.password === req.body.password) {
  //   return next(new errorHandler("New Password cannot be same as old one"));
  // }

  //change pwd
  const hashpwd = await bycrypt.hash(req.body.password, 10);

  user.password = hashpwd;
  user.resetPasswordExpire = undefined;
  user.resetPasswordToken = undefined;

  await user.save();
  res.status(200).json({ success: true, msg: `Reset Password` });
});
