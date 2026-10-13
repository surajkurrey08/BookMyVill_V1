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
        },
        footerDescription: {
            type: String,
            trim: true,
            maxlength: 240,
            default: 'Creating unforgettable experiences in the hills. Book your perfect stay and explore the beauty of Mahabaleshwar with us.'
        },
        contactPhone: {
            type: String,
            trim: true,
            maxlength: 30,
            default: '+91 98765 43210'
        },
        contactEmail: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 120,
            default: 'support@bookmyvilla.com'
        },
        contactLocation: {
            type: String,
            trim: true,
            maxlength: 160,
            default: 'Mahabaleshwar, Maharashtra, India'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('SocialLinks', socialLinksSchema);

