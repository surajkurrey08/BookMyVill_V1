const mongoose = require('mongoose');

const socialLinksSchema = new mongoose.Schema(
    {
        key:{
            type: String,
            default: 'footer',
            unique: true,
            immutable: true
        },
        facebook: {
            type: String,
            trim: true,
            default: ''
        },
        instagram: {
            type: String,
            trim: true,
            default: ''
        },
        x: {
            type: String,
            trim: true,
            default: ''
        },
        youtube: {
            type: String,
            trim: true,
            default: ''
        },
        whatsapp: {
            type: String,
            trim: true,
            default: ''
        },
        linkedin: {
            type: String,
            trim: true,
            default: ''
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('SocialLinks', socialLinksSchema);

