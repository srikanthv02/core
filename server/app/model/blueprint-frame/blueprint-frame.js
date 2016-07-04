/*
 Copyright [2016] [Relevance Lab]

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
var mongoose = require('mongoose');
var util = require('util');
var Schema = mongoose.Schema;

//@TODO Unique validation for name to be added
var BlueprintFrameSchema = new Schema({
    environmentId: {
        type: String,
        required: true,
        trim: false
    },
    blueprintId: {
        type: String,
        required: true,
        trim: false
    },
    state: {
        type: String,
        required: true,
        trim: true,
        default: null
    },
    stateMap: {
        type: Schema.Types.Mixed,
        _id: false
    },
    isDeleted: {
        type: Boolean,
        required: true,
        default: false
    }
});

BlueprintFrameSchema.statics.createNew = function createNew(data, callback) {
    var self = this;
    var blueprintLaunchFrame = new self(data);
    blueprintLaunchFrame.save(function (err, data) {
        if (err) {
            return callback(err);
        } else {
            return callback(null, blueprintLaunchFrame);
        }
    });
};

var BlueprintFrames = mongoose.model('blueprintFrames', BlueprintFrameSchema);
module.exports = BlueprintFrames;