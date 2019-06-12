/**EXPORT MODULES */
const mongoose = require('mongoose')
const { Schema } = mongoose

const MonitorEvent = new Schema(
  {
    output: { type: String, default: '', requrie: true, trim: true },
    priority: { type: String, default: '', requrie: true, trim: true },
    rule: { type: String, default: '', requrie: true, trim: true },
    time: { type: String, default: '', requrie: true, trim: true },
    output_fields: { type: Object, default: {} }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
)

module.exports = mongoose.model('MonitorEvent', MonitorEvent)
