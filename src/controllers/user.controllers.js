import {asyncHandler} from "../utils/asyncHandler.js";
import {User} from "../models/user.models.js";
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import {uploadOnCludinary} from "../utils/cloudinary.js";
import { getAccessToken,getefreshToken } from "../utils/generateJWTtoken.js";
import cookieParser from "cookie-parser";

const registerUser = asyncHandler(async (req,res,next) => {
    const {username, email, fullName, password} = req.body;
    // console.log(req.body);
    if([username,email,fullName,password].some((field) => !field?.trim())){
        throw new ApiError(400,"All Fields Required");
    }

    // console.log(req.files);

    const avatarLocalPath = req.files?.avatar ? req.files.avatar[0]?.path : null;
    const coverImageLocalPath = req.files?.coverImage ? req.files.coverImage[0]?.path : null;

    if(!avatarLocalPath) throw new ApiError(400,"Avatar Is required");

    const existedUser = await User.find({$or:[{username},{email}]});
    
    // console.log(existedUser);

    if(existedUser.length != 0) throw new ApiError(400,"User Already Exist with same username");

    const avatar = await uploadOnCludinary(avatarLocalPath);
    const coverImage = await uploadOnCludinary(coverImageLocalPath);

    if(!avatar) throw new ApiError(500,"Avatar Upload failed");
    
    const user = await User.create({
        username,
        email,
        fullName,
        avatar : avatar?.url || "",
        coverImage : coverImage?.url || "" ,
        password
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    if(!createdUser){
        throw new ApiError(500,"User Creation Failed");
    }

    res.status(201).send(new ApiResponse(201,"User Creation Successfull",createdUser));
});

//////////////////////////////////////// Login Controller ///////////////////////////////////////////////////////////////////

const loginUser = asyncHandler(async (req,res,next) => {
    const {userId,password} = req.body;
    // console.log(req.body);
    if( !userId && !password) throw new ApiError(400,"All fields are reuired.");

    const user = await User.find({$or:[{username : userId},{email : userId}]});
    if(!user) throw new ApiError(400,"Invalid Credentials");
    
    const accessToken = await getAccessToken(user[0]).then(token=>{return token});
    const refreshToken = await getefreshToken(user[0]).then(token=>{return token});
    // console.log(accessToken);
    // console.log(refreshToken);
    const updatedUser = await User.findById(user[0]._id).select("-password -refreshToken");

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(200,"user logined sucessfully",{user : updatedUser,refreshToken,accessToken}));
    
})

//////////////////////////////////////////////////// secured route /////////////////////////////////////////////

const logoutUser = asyncHandler(async(req,res,next)=>{
    const user = req.user;
    await User.findByIdAndUpdate(user._id,{$set:{refreshToken:""}},{new:true});
    res.status(200)
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200,"User logged Out",null));
})

export {registerUser,loginUser,logoutUser};