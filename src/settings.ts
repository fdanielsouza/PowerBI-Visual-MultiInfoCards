/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

"use strict";

import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import { TooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class VisualSettings extends DataViewObjectsParser {
      public cards: CardsSettings = new CardsSettings();
      public cardsTitles: CardsTitlesSettings = new CardsTitlesSettings();
      public cardsInformations: CardsInformationsSettings = new CardsInformationsSettings();
      }

export class CardsSettings {
      // Default card width
      public cardWidth: number = 280;
      // Default background color
      public backgroundColor: string = "#FFFFFF";
      // Default background transparency
      public backgroundTransparency: number = 0;
      // Default border width
      public strokeWidth: number = 0;
      // Default border color
      public borderColor: string = "black";
      // Default border radius
      public borderRadius: number = 0;
      }

export class CardsTitlesSettings {
      // Default font size
      public titleFontSize: number = 12;
      // Default font family
      public fontFamily: string = "wf_standard-font, helvetica, arial, sans-serif";
      // Default font color
      public fontColor: string = "black";
}

export class CardsInformationsSettings {
      // Default information name font size
      public fontSize: number = 10;
      // Default information name font family
      public fieldsFontFamily: string = "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
      // Default information name font color
      public fieldsFontColor: string = "#666666";
      // Default information value font size
      public secFontSize: number = 10;
      // Default information value font family
      public valuesFontFamily: string = "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
      // Default information value font color
      public valuesFontColor: string = "black";
      // Default information numeric display units
      public valuesDisplayUnits: string = "Auto";
}

