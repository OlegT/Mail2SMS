/**
 * JotForm Form object
 */
JotForm = {
    /**
     * @var JotForm domain
     */
    url: "http://www.jotform.com/", // Will get the correct URL from this.getServerURL() method
    /**
     * @var JotForm request server location
     */
    server: "http://www.jotform.com/server.php", // Will get the correct URL from this.getServerURL() method
    /**
     * @var All conditions defined on the form
     */
    conditions: {},
    /**
     * @var condValues
     */
    condValues: {},
    /**
     * @var All JotForm forms on the page
     */
    forms: [],
    /**
     * @var Will this form be saved on page changes
     */
    saveForm: false,
    /**
     * @var Array of extensions
     */
    imageFiles: ["png", "jpg", "jpeg", "ico", "tiff", "bmp", "gif", "apng", "jp2", "jfif"],
    /**
     * @var array of autocomplete elements
     */
    autoCompletes: {},
    /**
     * @var Array of default values associated with element IDs
     */
    defaultValues: {},
    /**
     * Debug mode
     */
    debug: false,
    /**
     * Check if the focused inputs must be highligted or not
     */
    highlightInputs: true,
    /**
     * Find the correct server url from forms action url, if there is no form use the defaults
     */
    getServerURL: function(){
        var form = $$('.jotform-form')[0];
        if (form) {
            var action = form.readAttribute('action');
            if (action) {
                this.server = action.replace('submit.php', 'server.php');
                this.url    = action.replace('submit.php', '');
            }
        }
    },
    /**
     * Indicates that form is still under initialization
     */
    initializing: true,
    /**
     * Keeps the last focused input
     */
    lastFocus: false,
    /**
     * Status of multipage save
     */
    saving:false,
    /**
     * Texts used in the form
     */
    texts: {
        pleaseWait:         'Please wait...',
        confirmClearForm:   'Are you sure you want to clear the form',
        lessThan:           'Your score should be less than',
        incompleteFields:   'There are incomplete required fields. Please complete them.',
        required:           'This field is required.',
        email:              'Enter a valid e-mail address',
        alphabetic:         'This field can only contain letters',
        numeric:            'This field can only contain numeric values',
        alphanumeric:       'This field can only contain letters and numbers.',
        uploadExtensions:   'You can only upload following files:',
        uploadFilesize:     'File size cannot be bigger than:'
    },
    /**
     * Changes only the given texsts
     * @param {Object} newTexts
     */
    alterTexts: function(newTexts){
        Object.extend(this.texts, newTexts || {}); 
    },
    
    /**
     * Creates the console arguments
     */
    createConsole: function(){
        var consoleFunc = ['log', 'info', 'warn', 'error'];
        $A(consoleFunc).each(function(c){
            this[c] = function(){
                if(JotForm.debug){
                    if('console' in window){
                        try{
                            console[c].apply(this, arguments);
                        }catch(e){
                            if(typeof arguments[0] == "string"){
                                console.log( c.toUpperCase() + ": " + $A(arguments).join(', '));
                            }else{
                                if(Prototype.Browser.IE){
                                    alert(c+": "+arguments[0]);
                                }else{
                                    console[c](arguments[0]);
                                }
                            }
                        }
                    }
                }
            };
        }.bind(this));
        
        if(JotForm.debug){
            JotForm.debugOptions = document.readJsonCookie('debug_options');
        }
    },
    /**
     * Initiates the form and all actions
     */
    init: function(callback){
        var ready = function(){
            try {
                if(document.get.debug == "1"){
                    this.debug = true;
                }
                this.createConsole();
                
                this.getServerURL();
                
                (callback && callback());
                
                if ((document.get.mode == "edit" || document.get.mode == "inlineEdit") && document.get.sid) {
                    this.editMode();
                }
                this.uniqueID = this.uniqid();
                this.checkMultipleUploads();
                this.handleSavedForm();
                this.setTitle();
                this.getDefaults();
                this.handlePayPalProMethods();
                this.handleFormCollapse();
                this.handlePages();
                this.highLightLines();
                this.setButtonActions();
                this.initGradingInputs();
                this.setConditionEvents();
                this.prePopulations();
                this.handleAutoCompletes();
                this.handleTextareaLimits();
                this.handleRadioButtons();
                this.setFocusEvents();
                this.disableAcceptonChrome();
                
                $A(document.forms).each(function(form){
                    if (form.name == "form_" + form.id || form.name == "q_form_" + form.id) {
                        this.forms.push(form);
                    }
                }.bind(this));
                this.validator();
            } catch (err) {
                 JotForm.error(err);
            }
            this.initializing = false; // Initialization is over
        }.bind(this);
        
        if(document.readyState == 'complete' || (this.jsForm && document.readyState == undefined) ){
            ready();
        }else{
            document.ready(ready);            
        }
    },
    
    /**
     * Check if there are any multiple upload field. if any load multiple upload script
     */
    checkMultipleUploads: function(){
        if($$('.form-upload-multiple').length > 0){
            var script = document.createElement('script');
            script.type="text/javascript";
            script.src = this.url+"file-uploader/fileuploader.js";
            $(document.body).appendChild(script);
        }
    },
    /**
     * Php.js uniqueID generator
     * @param {Object} prefix
     * @param {Object} more_entropy
     */
    uniqid: function(prefix, more_entropy){
        if (typeof prefix == 'undefined') { prefix = ""; }
        var retId;
        var formatSeed = function(seed, reqWidth){
            seed = parseInt(seed, 10).toString(16); // to hex str
            if (reqWidth < seed.length) { return seed.slice(seed.length - reqWidth); }
            if (reqWidth > seed.length) { return Array(1 + (reqWidth - seed.length)).join('0') + seed; }
            return seed;
        };
        if (!this.php_js) { this.php_js = {}; }
        if (!this.php_js.uniqidSeed) { this.php_js.uniqidSeed = Math.floor(Math.random() * 0x75bcd15); }
        this.php_js.uniqidSeed++;
        retId = prefix;
        retId += formatSeed(parseInt(new Date().getTime() / 1000, 10), 8);
        retId += formatSeed(this.php_js.uniqidSeed, 5);
        if (more_entropy) { retId += (Math.random() * 10).toFixed(8).toString(); }
        return retId;
    },

    /**
     * Initiates multiple upload scripts
     */
    initMultipleUploads: function(){
        $$('.form-upload-multiple').each(function(file){
            var parent = file.up('div'); 
            var f = JotForm.getForm(file);
            var formID = f.formID.value;
            var uniq = formID+"_"+JotForm.uniqueID;
            
            // Handle default validations. reuired field
            var className = file.className;
            if(className.include("validate[required]")){
                parent.addClassName("validate[required]");
            }
            
            // Create temp upload folder key 
            var hidden = new Element('input', {type:'hidden', name:'temp_upload_folder'}).setValue(uniq);
            f.insert({top:hidden});
            
            // Handle limited extensions
            var exts = (file.readAttribute('file-accept') || "").strip();
            exts = (exts !== '*')? exts.split(', ') : [];
            
            // Handle sublabels
            var n, subLabel ="";
            if((n = file.next()) && n.hasClassName('form-sub-label')){ subLabel = n.innerHTML; }
            
            // Initiate ajax uploader
            var uploader = new qq.FileUploader({
                debug: JotForm.debug,
                element: parent,
                action: JotForm.server,
                subLabel: subLabel,
                sizeLimit: parseInt(file.readAttribute('file-maxsize'), 10) * 1024, // Set file size limit
                allowedExtensions: exts,
                onComplete: function(id, aa, result){
                    if(result.success){
                        // This is needed for validations.
                        // removes reuired message
                        parent.value="uploaded";
                        JotForm.corrected(parent);
                    }
                },
                showMessage: function(message){
                    // Display errors in JotForm's way
                    JotForm.errored(parent, message);
                    setTimeout(function(){
                        // JotForm.corrected(parent);
                    }, 3000);
                },
                params: {
                    action: 'multipleUpload',
                    field: file.name.replace('[]', ''),
                    folder: uniq
                }
            });
        });
    },
    
    /**
     * Hiddenly submits the form on backend
     */
    hiddenSubmit: function(frm){
        
        if(JotForm.currentSection){
            JotForm.currentSection.select('.form-pagebreak')[0].insert(
                new Element('div', {className:'form-saving-indicator'})
                    .setStyle('float:right;padding:21px 12px 10px')
                    .update('<img src="'+JotForm.url+'images/ajax-loader.gif" align="absmiddle" /> Saving...')
            );
        }
        
        /**
         * Wait just a little to set saving status. 
         * We need this because of the back button hack for last page. 
         * Last page back button has two click events they both should work 
         * but saving status prevents second one to be working
         */
        setTimeout(function(){ JotForm.saving = true; }, 10);
        
        if(!$('hidden_submit_form')){
            var iframe = new Element('iframe', {name:'hidden_submit', id:'hidden_submit_form'}).hide();
            iframe.observe('load', function(){
                JotForm.makeUploadChecks();
                $$('.form-saving-indicator').invoke('remove');
                JotForm.saving = false;
            });
            $(document.body).insert(iframe);
        }
        $('current_page').value = JotForm.currentSection.pagesIndex;
        frm.writeAttribute('target', 'hidden_submit');
        frm.insert({
            top: new Element('input', {
                type: 'hidden',
                name: 'hidden_submission',
                id:   'hidden_submission'
            }).putValue("1")
        });
        
        frm.submit();
        frm.writeAttribute('target', '');
        $('hidden_submission').remove();
    },
    /**
     * Checks the upload fields after hidden submission
     * If they are completed, then makes them empty to prevent
     * Multiple upload of the same file
     */
    makeUploadChecks: function(){
        var formIDField = $$('input[name="formID"]')[0];
        new Ajax.Jsonp(JotForm.url+'server.php', {
            parameters: {
                action: 'getSavedUploadResults',
                formID: formIDField.value,
                sessionID: document.get.session
            },
            evalJSON: 'force',
            onComplete: function(t){
                var res = t.responseJSON;
                if (res.success) {                    
                    if(res.submissionID && !$('submission_id')){
                        formIDField.insert({
                            after: new Element('input', {
                                type: 'hidden',
                                name: 'submission_id',
                                id:   'submission_id'
                            }).putValue(res.submissionID)
                        });                        
                    }
                    JotForm.editMode(res, true); // Don't reset fields
                }
            }
        });
    },
    /**
     * Handles the form being saved stuation
     */
    handleSavedForm: function(){
        
        if(!('session' in document.get)){
            return;
        }
        JotForm.saveForm = true;
        
        var formIDField = $$('input[name="formID"]')[0];
        
        formIDField.insert({
            after: new Element('input', {
                type: 'hidden',
                name: 'session_id',
                id:  "session"
            }).putValue(document.get.session)
        });
        
        formIDField.insert({
            after: new Element('input', {
                type: 'hidden',
                id:'current_page',
                name: 'current_page'
            }).putValue(0)
        });
        
        new Ajax.Jsonp(JotForm.url+'server.php', {
            parameters: {
                action: 'getSavedSubmissionResults',
                formID: formIDField.value,
                sessionID: document.get.session
            },
            evalJSON: 'force',
            onComplete: function(t){
                var res = t.responseJSON;
                if (res.success) {
                    if(res.submissionID){
                        formIDField.insert({
                            after: new Element('input', {
                                type: 'hidden',
                                name: 'submission_id',
                                id:   'submission_id'
                            }).putValue(res.submissionID)
                        });                        
                    }
                    try{
                        JotForm.editMode(res);
                    }catch(e){
                        console.error(e);
                    }
                    JotForm.openInitially = res.currentPage - 1;
                }
            }
        });
    },
    /**
     * Place the form title on pages title to remove the Form text on there
     */
    setTitle: function(){
        // Do this only when page title is form. otherwise it can overwrite the users own title
        if(document.title == "Form"){
            var head;
            if((head = $$('.form-header')[0])){
                document.title = head.innerHTML;
            }
        }
    },
    
    /**
     * Sets the last focus event to keep latest focused element
     */
    setFocusEvents: function(){
        $$('.form-textbox, .form-password, .form-radio, .form-checkbox, .form-textarea, .form-upload, .form-dropdown').each(function(input){
            input.observe('focus', function(){
                JotForm.lastFocus = input;
            });
        });
    },
    /** 
    * Disables Accept for Google Chrome browsers
    */
    disableAcceptonChrome: function(){
        if (!Prototype.Browser.WebKit) { return; }
        $$('.form-upload').each(function(input){
            if (input.hasAttribute('accept')) {
                var r = input.readAttribute('accept');
                input.writeAttribute('accept', '');
                input.writeAttribute('file-accept', r);
            }
        });
    },
    

    /**
     * Sets calendar to field
     * @param {Object} id
     */
    setCalendar: function(id){
        try{
            Calendar.setup({
                triggerElement:"input_" + id + "_pick",
                dateField:"year_" + id,
                selectHandler:JotForm.formatDate
            });
            $('id_'+id).observe('keyup', function(){
                $('id_'+id).fire('date:changed');
            });
            if(! $('day_' + id).hasClassName('noDefault')){
                JotForm.formatDate({date:(new Date()), dateField:$('id_' + id)});
            }
        }catch(e){
            JotForm.error(e);
        }
    },
    /**
     * Collects all inital values of the fields and saves them as default values
     * to be restored later
     */
    getDefaults: function(){
        $$('.form-textbox, .form-dropdown, .form-textarea').each(function(input){
            if(input.hinted || input.value === ""){ return; /* continue; */ }
            
            JotForm.defaultValues[input.id] = input.value;
        });
    },
    /**
     * Enables or disables the Other option on radiobuttons
     */
    handleRadioButtons: function(){
        
        $$('.form-radio-other-input').each(function(inp){
            inp.disable().hint('Other');
        });
        
        $$('.form-radio').each(function(radio){
            
            var id = radio.id.replace(/input_(\d+)_\d+/gim, '$1');
            
            if(id.match('other_')){
                id = radio.id.replace(/other_(\d+)/, '$1');
            }
            
            if($('other_'+id)){
                var other = $('other_'+id);
                var other_input = $('input_'+id);
                
                radio.observe('click', function(){
                    if(other.checked){
                        other_input.enable();
                        other_input.select();
                    }else{
                        (other_input.hintClear && other_input.hintClear());
                        other_input.disable();
                    }
                });
            }
        });
    },
    
    handleTextareaLimits: function(){
        $$('.form-textarea-limit-indicator span').each(function(el){
            var inpID = el.id.split('-')[0];
            if(!$(inpID)){return;} // cannot find the main element
            var limitType = el.readAttribute('type');
            var limit     = el.readAttribute('limit');
            var input = $(inpID);
            input.observe('keyup', function(e){
                var count;
                if(limitType == 'Words'){
                    count = $A(input.value.split(/\s+/)).without("").length;
                }else if(limitType == 'Letters'){
                    count = input.value.length;
                }
                if(count > limit){
                    $(el.parentNode).addClassName('form-textarea-limit-indicator-error');
                }else{
                    $(el.parentNode).removeClassName('form-textarea-limit-indicator-error');
                }
                el.update(count + "/" + limit);
            });
            input.run('keyup');
        });
    },
    
    /**
     * Activates all autocomplete fields
     */
    handleAutoCompletes: function(){
        // Get all autocomplete fields
        $H(JotForm.autoCompletes).each(function(pair){
            var el = $(pair.key); // Field itself
            
            el.writeAttribute('autocomplete', 'off');
            
            var parent = $(el.parentNode); // Parent of the field for list to be inserted
            var values = $A(pair.value.split('|')); // Values for auto complete
            var dims = el.getDimensions(); // Dimensions of the input box
            var offs = el.cumulativeOffset();
            var lastValue; // Last entered value
            var selectCount = 0; // Index of the currently selected element
            //parent.setStyle('position:relative;z-index:1000;'); // Set parent position to relative for inserting absolute positioned list
            var liHeight = 0; // Height of the list element
            // Create List element with must have styles initially
            var list = new Element('div', {
                className: 'form-autocomplete-list'
            }).setStyle({
                listStyle: 'none',
                listStylePosition: 'outside',
                position: 'absolute',
                top: ((dims.height+offs[1])) + 'px',
                left:offs[0]+'px',
                width: ((dims.width < 1? 100 : dims.width) - 2) + 'px',
                zIndex: '10000'
            }).hide();
            // Insert list onto page
            // parent.insert(list);
            $(document.body).insert(list);
            
            list.close = function(){
                list.update();
                list.hide();
                selectCount = 0;
            };
            
            // Hide list when field get blurred
            el.observe('blur', function(){
                list.close();
            });
            
            // Search entry in values when user presses a key
            el.observe('keyup', function(e){
                var word = el.value;
                // If entered value is the same as the old one do nothing
                if (lastValue == word) {
                    return;
                }
                lastValue = word; // Set last entered word
                list.update(); // Clean up the list first
                if (!word) {
                    list.close();
                    return;
                } // If input is empty then close the list and do nothing
                // Get matches
                var matches = values.collect(function(v){
                    if (v.toLowerCase().include(word.toLowerCase())) {
                        return v;
                    }
                }).compact();
                // If matches found
                if (matches.length > 0) {
                    matches.each(function(match){
                        var li = new Element('li', {
                            className: 'form-autocomplete-list-item'
                        });
                        var val = match;
                        li.val = val;
                        try {
                            val = match.replace(new RegExp('(' + word + ')', 'gim'), '<b>$1</b>');
                        } 
                        catch (e) {
                            JotForm.error(e);
                        }
                        li.insert(val);
                        li.onmousedown = function(){
                            el.value = match;
                            list.close();
                        };
                        list.insert(li);
                    });
                    list.show();
                    // Get li height by adding margins and paddings for calculating 10 item long list height
                    liHeight = liHeight || $(list.firstChild).getHeight() + (parseInt($(list.firstChild).getStyle('padding'), 10) || 0) + (parseInt($(list.firstChild).getStyle('margin'), 10) || 0);
                    // limit list to show only 10 item at once        
                    list.setStyle({
                        height: (liHeight * ((matches.length > 9) ? 10 : matches.length) + 4) + 'px',
                        overflow: 'auto'
                    });
                } else {
                    list.close(); // If no match found clean the list and close
                }
            });
            
            // handle navigation through the list
            el.observe('keydown', function(e){
                
                //e = document.getEvent(e);
                var selected; // Currently selected item
                // If the list is not visible or list empty then don't run any key actions
                if (!list.visible() || !list.firstChild) {
                    return;
                }
                
                // Get the selected item
                selected = list.select('.form-autocomplete-list-item-selected')[0];
                (selected && selected.removeClassName('form-autocomplete-list-item-selected'));
                
                switch (e.keyCode) {
                    case Event.KEY_UP: // UP
                        if (selected && selected.previousSibling) {
                            $(selected.previousSibling).addClassName('form-autocomplete-list-item-selected');
                        } else {
                            $(list.lastChild).addClassName('form-autocomplete-list-item-selected');
                        }
                        
                        if (selectCount <= 1) { // selected element is at the top of the list
                            if (selected && selected.previousSibling) {
                                $(selected.previousSibling).scrollIntoView(true);
                                selectCount = 0; // scroll element into view then reset the number
                            } else {
                                $(list.lastChild).scrollIntoView(false);
                                selectCount = 10; // reverse the list
                            }
                        } else {
                            selectCount--;
                        }
                        
                        break;
                    case Event.KEY_DOWN: // Down
                        if (selected && selected.nextSibling) {
                            $(selected.nextSibling).addClassName('form-autocomplete-list-item-selected');
                        } else {
                            $(list.firstChild).addClassName('form-autocomplete-list-item-selected');
                        }
                        
                        if (selectCount >= 9) { // if selected element is at the bottom of the list
                            if (selected && selected.nextSibling) {
                                $(selected.nextSibling).scrollIntoView(false);
                                selectCount = 10; // scroll element into view then reset the number
                            } else {
                                $(list.firstChild).scrollIntoView(true);
                                selectCount = 0; // reverse the list
                            }
                        } else {
                            selectCount++;
                        }
                        break;
                    case Event.KEY_ESC:
                        list.close(); // Close list when pressed esc
                        break;
                    case Event.KEY_TAB:
                    case Event.KEY_RETURN:
                        if (selected) { // put selected field into the input bıx
                            el.value = selected.val;
                            lastValue = el.value;
                        }
                        list.close();
                        if (e.keyCode == Event.KEY_RETURN) {
                            e.stop();
                        } // Prevent return key to submit the form
                        break;
                    default:
                        return;                
                }
            });
        });
        
    },
    
    /**
     * Returns the extension of a file
     * @param {Object} filename
     */
    getFileExtension: function(filename){
        return (/[.]/.exec(filename)) ? (/[^.]+$/.exec(filename))[0] : undefined;
    },
    
    /**
     * Fill fields from the get values prepopulate
     */
    prePopulations: function(){
        $H(document.get).each(function(pair){
            var n = '[name*="_' + pair.key + '"]';
            var input = $$('.form-textbox%s, .form-dropdown%s, .form-textarea%s, .form-hidden%s'.replace(/\%s/gim, n))[0];
            if (input) {
                input.value = pair.value.replace('+', ' ');
            }
            $$('.form-checkbox%s, .form-radio%s'.replace(/\%s/gim, n)).each(function(input){
            
                input.checked = $A(pair.value.split(',')).include(input.value);
            });
        });
    },
    /**
     * Reset form while keeping the values of hidden fields
     * @param {Object} frm
     */
    resetForm: function(frm){
        var hiddens = $(frm).select('input[type="hidden"]');
        hiddens.each(function(h){ h.__defaultValue = h.value; });
        $(frm).reset();
        hiddens.each(function(h){ h.value = h.__defaultValue; });
        return frm;
    },
    /**
     * Bring the form data for edit mode
     */
    editMode: function(data, noreset){
        
        var populateData = function(res){
            
            if(!noreset){
                // Prevent autocompleting old values aka. form input cache
                
                $A(JotForm.forms).each(function(frm){
                    JotForm.resetForm(frm);
                });
            }
            
            $H(res.result).each(function(pair){
                var qid = pair.key, question = pair.value;
                switch (question.type) {
                    case "control_fileupload":
                        if($('input_' + qid).uploadMarked == question.value){ break; }
                        
                        $$('#clip_'+qid+', #link_'+qid+', #old_'+qid).invoke('remove');
                        
                        $('input_' + qid).uploadMarked = question.value;
                        $('input_' + qid).resetUpload();
                        var file = question.value.split("/");
                        var filename = file[file.length - 1];
                        var ext = JotForm.getFileExtension(filename);
                        if (JotForm.imageFiles.include(ext.toLowerCase())) {
                            var clipDiv = new Element('div', {id:'clip_'+qid}).setStyle({
                                height: '50px',
                                width: '50px',
                                overflow: 'hidden',
                                marginRight: '5px',
                                border: '1px solid #ccc',
                                background: '#fff',
                                cssFloat: 'left'
                            });
                            var img = new Element("img", {
                                src: question.value,
                                width: 50
                            });
                            clipDiv.insert(img);
                            $('input_' + qid).insert({before: clipDiv});
                        }
                        var linkContainer = new Element('div', {id:'link_'+qid});
                        $('input_' + qid).insert({
                            after: linkContainer.insert(new Element('a', {
                                href: question.value,
                                target: '_blank'
                            }).insert(filename.shorten(40)))
                        });
                        $('input_' + qid).insert({
                            after: new Element('input', {
                                type:'hidden',
                                name:'input_' + qid + '_old',
                                id:  'old_'+qid
                            }).putValue(question.items)
                        });
                        break;
                    case "control_scale":
                    case "control_radio":
                        var radios = document.getElementsByName("q" + qid + "_" + ((question.type == "control_radio") ? question.name : qid));
                        $A(radios).each(function(rad){
                            if (rad.value == question.value) {
                                rad.checked = true;
                            }
                        });
                        break;
                    case "control_checkbox":
                        var checks = $$("#id_" + qid + ' input[type="checkbox"]');
                        
                        $A(checks).each(function(chk){
                            if (question.items.include(chk.value)) {
                                chk.checked = true;
                            }
                        });
                        break;
                    case "control_rating":
                        ($('input_' + qid) && ($('input_' + qid).setRating(question.value)));
                        break;
                    case "control_grading":
                        var boxes = document.getElementsByName("q" + qid + "_" + qid + "[]");
                        $A(boxes).each(function(box, i){
                            box.putValue(question.items[i]);
                        });
                        break;
                    case "control_slider":
                        $('input_' + qid).setSliderValue(question.value);
                        break;
                    case "control_range":
                        $('input_' + qid + "_from").putValue(question.items.from);
                        $('input_' + qid + "_to").putValue(question.items.to);
                        break;
                        
                    case "control_matrix":
                        var extended, objj = false;
                        // If you don't select first line or first row on a matrix
                        // Items will come as an object instead of an array
                        // It's because keys don't start from zero
                        // I have to simulate the array on this sittuations
                        if(!Object.isArray(question.items)){
                            extended = $H(question.items);
                            objj = true;
                        }else{
                            extended = $A(question.items);
                        }
                        
                        extended.each(function(item, i){
                            // Here is the simulation of an array :)
                            if(objj){
                                i = item.key; 
                                item = item.value;
                            }
                            
                            if (Object.isString(item)) {
                                var els = document.getElementsByName("q" + qid + "_" + question.name + "[" + i + "]");
                                $A(els).each(function(el){
                                    if (el.value == item) {
                                        el.checked = true;
                                    }
                                });
                            } else {
                                $A(item).each(function(it, j){
                                    var els = document.getElementsByName("q" + qid + "_" + question.name + "[" + i + "][]");
                                    if (els[j].className == "form-checkbox") {
                                        $A(els).each(function(el){
                                            if (el.value == it) {
                                                el.checked = true;
                                            }
                                        });
                                    } else {
                                        els[j].value = it;
                                    }
                                });
                            }
                        });
                        break;
                    case "control_datetime":
                    case "control_fullname":
                        $H(question.items).each(function(item){
                            ($(item.key + "_" + qid) && ($(item.key + "_" + qid).value = item.value));
                        });
                        break;
                    case "control_phone":
                    case "control_birthdate":
                    case "control_address":
                        $H(question.items).each(function(item){
                            ($('input_' + qid + "_" + item.key) && ($('input_' + qid + "_" + item.key).putValue(item.value)));
                        });
                        break;
                    case "control_autoincrement":
                    case "control_hidden":
                        if($('input_' + qid)){
                            if(JotForm.saveForm || document.get.mode == 'edit'){
                                $('input_' + qid).putValue(question.value);
                            }else{
                                var sec = $$('.form-section')[0];
                                sec.insert({
                                    top:'<li id="id_'+qid+'" class="form-line" title="Hidden Field">'+
                                        '<label for="input_'+qid+'" id="label_'+qid+'" class="form-label-left"> '+question.text+' </label>'+
                                        '<div class="form-input" id="cid_'+qid+'"></div></li>'
                                });
                                $('cid_'+qid).insert($('input_' + qid).putValue(question.value));
                                $('input_' + qid).writeAttribute('type', 'text').setStyle({
                                    opacity: 0.9,
                                    border:'1px dashed #999',
                                    padding:'3px'
                                });
                            }
                        }
                        break;
                    default:
                        ($('input_' + qid) && ($('input_' + qid).putValue(question.value)));
                        break;
                }
            });
            
            // After populating the form run condition checks
            $H(JotForm.fieldConditions).each(function(pair){
                var field = pair.key;
                var event = pair.value.event;
                
                JotForm.info("Has Condition:", field, $(field));                
                if(!$(field)){ return; }
                
                $(field).run(event);
            });
        };
        
        if(data){
            
            populateData(data);
            
        }else{
            new Ajax.Request('server.php', {
                parameters: {
                    action: 'getSubmissionResults',
                    formID: document.get.sid
                },
                evalJSON: 'force',
                onComplete: function(t){
                    var res = t.responseJSON;
                    if (res.success) {
                        
                        populateData(res);
                        
                        $$('input[name="formID"]')[0].insert({
                            after: new Element('input', {
                                type: 'hidden',
                                name: 'editSubmission'
                            }).putValue(document.get.sid)
                        });
                        
                        if(document.get.mode == "inlineEdit"){
                            $$('input[name="formID"]')[0].insert({
                                after: new Element('input', {
                                    type: 'hidden',
                                    name: 'inlineEdit'
                                }).putValue("yes")
                            });
                        }
                        
                    }
                }.bind(this)
            });
        }        
    },
    /**
     * add the given condition to conditions array to be used in the form
     * @param {Object} qid id of the field
     * @param {Object} condition condition array
     */
    setConditions: function(conditions){
        JotForm.conditions = conditions;
    },
    /**
     * Shows a field
     * @param {Object} field
     */
    showField: function(field){
        
        if(!$('id_'+field)){ return; }
        
        if($('id_'+field).visible()){
            return $('id_'+field);
        }
        /*
        $('id_'+field).setStyle({
            backgroundColor: '#fff'
        }).show();
        $('id_'+field).shift({
            backgroundColor: '#EEEEE0',
            duration: 2,
            easing: 'pulse',
            easingCustom: '2',
            onEnd: function(e){
                e.setStyle({
                    backgroundColor: ''
                });
            }
        });
        */
        
        if('input_'+field in JotForm.defaultValues){
            $('input_'+field).value = JotForm.defaultValues['input_'+field];
        }
        
        return $('id_'+field).show();
    },
    
    /**
     * Hides a field
     * @param {Object} field
     */
    hideField: function(field){
        if($('id_'+field)){
            $('id_'+field).select('input, select, textarea').each(function(input){
                if(input.tagName == 'INPUT' && (['checkbox', 'radio'].include(input.readAttribute('type')))){
                    input.checked = false;
                    if(JotForm.isVisible(input)){
                        JotForm.getContainer(input).run('click');                        
                    }
                    return;
                }
                input.clear();
                if(JotForm.isVisible(input)){
                    input.run('keyup').run('change').run('date:changed');
                }
            });
            return $('id_'+field).hide();
        }
    },
    
    /**
     * Checks the fieldValue by given operator string
     * @param {Object} operator
     * @param {Object} condValue
     * @param {Object} fieldValue
     */
    checkValueByOperator: function(operator, condValueOrg, fieldValueOrg){
        
        var fieldValue = Object.isBoolean(fieldValueOrg)? fieldValueOrg : fieldValueOrg.toString().strip();
        var condValue  = Object.isBoolean(condValueOrg)? condValueOrg : condValueOrg.toString().strip();
        
        JotForm.log('if "%s" %s "%s"', fieldValue, operator, condValue, "\t\t\t=> Originals:", "Field: '", fieldValueOrg, "', Cond: '", condValueOrg,"'");
        
        switch (operator) {
            case "equals":
                return fieldValue == condValue;
            case "notEquals":
                return fieldValue != condValue;
            case "endsWith":
                return fieldValue.endsWith(condValue);
            case "startsWith":
                return fieldValue.startsWith(condValue);
            case "contains":
                return fieldValue.include(condValue);
            case "notContains":
                return !fieldValue.include(condValue);
            case "greaterThan":
                return (parseInt(fieldValue, 10) || 0) > (parseInt(condValue, 10) || 0);
            case "lessThan":
                return (parseInt(fieldValue, 10) || 0) < (parseInt(condValue, 10) || 0);
            case "isEmpty":
                if(Object.isBoolean(fieldValue)){ return !fieldValue; }
                return fieldValue.empty();
            case "isFilled":
                if(Object.isBoolean(fieldValue)){ return fieldValue; }
                return !fieldValue.empty();
            case "before":
                return fieldValueOrg < condValueOrg;
            case "after":
                return fieldValueOrg > condValueOrg;
            default:
                JotForm.error("Could not find this operator", operator);
        }
        return false;
    },
    
    typeCache: {},   // Cahcke the check type results for performance
    /**
     * 
     * @param {Object} id
     */
    getInputType: function(id){
        if(JotForm.typeCache[id]){ return JotForm.typeCache[id]; }
        var type = false;
        if($('input_'+id)){
            type = $('input_'+id).nodeName.toLowerCase() == 'input'? $('input_'+id).readAttribute('type').toLowerCase() : $('input_'+id).nodeName.toLowerCase();
            if($('input_'+id).hasClassName("form-radio-other-input")){
            	type = "radio";
            }
        }else if($('input_'+id+'_pick')){
            type = 'datetime';
        }else{
            if($$('#id_'+id+' input')[0]){
                type = $$('#id_'+id+' input')[0].readAttribute('type').toLowerCase();
                if(type == "text"){
                    type = "combined";
                }
            }
        }
        JotForm.typeCache[id] = type;
        return type;
    },
    /**
     * Parses ISO Date string to a real date
     * @param {Object} str
     */
    strToDate: function(str){
        // When cannot parse return an invalid date
        var invalid = new Date(undefined);
        var match   = /(\d{4})\-(\d{2})-(\d{2})T?(\d{2})?\:?(\d{2})?/gim;
        
        if(str.empty()){ return invalid; }
        
        // if(!str.include("T")){ str += "T00:00"; }
        
        if(!match.test(str)){ return invalid; }
        
        var d = new Date();
        str.replace(match, function(all, year, month, day, hour, minutes){
            d.setYear(parseInt(year, 10));
            d.setMonth(parseInt(month, 10)-1);
            d.setDate(parseInt(day, 10))
            if(hour){
                d.setHours(parseInt(hour, 10));
                d.setMinutes(parseInt(minutes, 10));
            }
            return all;
        });
        
        //JotForm.log("Date:", str, d);
        
        return d;
    },
    
    getDateValue: function(id){
        var date = "";
        if($('year_'+id)){
            date += ($('year_'+id).value || "%empty%");
        }
        if($('month_'+id)){
            date += "-"+($('month_'+id).value || "%empty%");
        }
        if($('day_'+id)){
            date += "-"+($('day_'+id).value || "%empty%");
        }
        
        if(date.include("%empty%")){
            JotForm.info("Wrong date: " + date);
            return "";
        }
        var h="";
        if($('ampm_'+id)){
            if($('hour_'+id)){
                h = $('hour_'+id).value;
                if($('ampm_'+id).value == 'pm'){
                    h = parseInt(h, 10)+12;
                }
                if(h == "24"){
                    h = 0;
                }
                date += "T"+ ((h.length == 1? "0"+h : h) || "00");
            }
        }else{
            if($('hour_'+id)){
                h = $('hour_'+id).value;
                date += "T"+((h.length == 1? "0"+h : h) || "00");
            }
        }
        
        if($('min_'+id)){
            date += ":"+($('min_'+id).value || "00");
        }
        if(h == ""){
            date += "T00:00";
        }
        return date;
    },
    /**
     * 
     * @param {Object} condition
     */
    checkCondition: function(condition){
        var any=false, all=true;
        
        $A(condition.terms).each(function(term){
            try{
                switch(JotForm.getInputType(term.field)){
                    case "combined":
                        if (['isEmpty', 'isFilled'].include(term.operator)) {
                            var filled = $$('#id_'+term.field+' input').collect(function(e){ return e.value; }).any();
                            
                            if(JotForm.checkValueByOperator(term.operator, term.value, filled)){
                                any = true;
                            }else{
                                all = false;
                            }
                            
                            return; /* continue; */ 
                        }
                    break;
                    case "datetime":
                        var value = JotForm.getDateValue(term.field);
                        if(value === undefined){ return; /* continue; */ }
                        
                        if (['isEmpty', 'isFilled'].include(term.operator)) {
                            if(JotForm.checkValueByOperator(term.operator, term.value, value)){
                                any = true;
                            }else{
                                all = false;
                            }
                            
                        }else{
                            if(JotForm.checkValueByOperator(term.operator, JotForm.strToDate(term.value), JotForm.strToDate(value))){
                                any = true;
                            }else{
                                all = false;
                            }
                        }
                    break;
                    case "checkbox":
                    case "radio":
                    
                        if (['isEmpty', 'isFilled'].include(term.operator)) {
                            var filled = $$('#id_'+term.field+' input').collect(function(e){ return e.checked; }).any();
                            
                            if(JotForm.checkValueByOperator(term.operator, term.value, filled)){
                                any = true;
                            }else{
                                all = false;
                            }
                            
                            return; /* continue; */ 
                        }
                        
                        $$('#id_'+term.field+' input').each(function(input){
                            var value = input.checked? input.value : '';
                            
                            if(JotForm.checkValueByOperator(term.operator, term.value, value)){
                                any = true;
                            }else{
                                // If not equals item is found condition should fail
                                if(term.operator == 'notEquals' && term.value == value){
                                    any = false;
                                    all = false;
                                    throw $break;
                                }
                                
                                if (input.value == term.value) {
                                    all = false;
                                }
                            }
                        });
                    break;
                    default:
                        var value = $('input_'+term.field).value;
                        if($('input_'+term.field).hinted){
                            value = "";
                        }
                        if(value === undefined){return;/* continue; */}
                        if(JotForm.checkValueByOperator(term.operator, term.value, value)){
                            any = true;
                        }else{
                            all = false;
                        }
                }
                
            }catch(e){ 
                JotForm.error(e);
            }
        });
        
        if(condition.type == 'field'){ // Field Condition
            JotForm.log("any: %s, all: %s, link: %s", any, all, condition.link.toLowerCase());
            if((condition.link.toLowerCase() == 'any' && any) || (condition.link.toLowerCase() == 'all' && all)){
                if(condition.action.visibility.toLowerCase() == 'show'){
                    JotForm.info('Correct: Show field: '+($('label_'+condition.action.field) && $('label_'+condition.action.field).innerHTML));
                    JotForm.showField(condition.action.field);
                }else{
                    JotForm.info('Correct: Hide field: '+($('label_'+condition.action.field) && $('label_'+condition.action.field).innerHTML));
                    JotForm.hideField(condition.action.field);
                }
            }else{
                if(condition.action.visibility.toLowerCase() == 'show'){
                    JotForm.info('Fail: Hide field: '+($('label_'+condition.action.field) && $('label_'+condition.action.field).innerHTML));
                    JotForm.hideField(condition.action.field);
                }else{
                    JotForm.info('Fail: Show field: '+($('label_'+condition.action.field) && $('label_'+condition.action.field).innerHTML));
                    JotForm.showField(condition.action.field);
                }
            }                
        }else{ // Page condition
        
            JotForm.log("any: %s, all: %s, link: %s", any, all, condition.link.toLowerCase());
            if (JotForm.nextPage) {
                return;
            }
            if((condition.link.toLowerCase() == 'any' && any) || (condition.link.toLowerCase() == 'all' && all)){
                
                JotForm.info('Correct: Skip To: '+condition.action.skipTo);
                var sections = $$('.form-section');
                if(condition.action.skipTo == 'end'){
                    JotForm.nextPage = sections[sections.length - 1];
                }else{
                    JotForm.nextPage = sections[parseInt(condition.action.skipTo.replace('page-', ''), 10)-1];
                }
                
            }else{
                
                JotForm.info('Fail: Skip To: page-'+JotForm.currentPage+1);
                
                JotForm.nextPage = false; 
            }
        }
        
    },
    currentPage: false,
    nextPage: false,
    previousPage: false,
    fieldConditions: {},
    
    setFieldConditions: function(field, event, condition){
        if(!JotForm.fieldConditions[field]){
            JotForm.fieldConditions[field] = {
                event: event,
                conditions:[]
            };
        }
        JotForm.fieldConditions[field].conditions.push(condition);
    },
    
    /**
     * Sets all events and actions for form conditions
     */
    setConditionEvents: function(){
        try {
            $A(JotForm.conditions).each(function(condition){
            
                if (condition.type == 'field') {
                
                    if (condition.action.visibility.toLowerCase() == 'show') {
                        ($('id_' + condition.action.field) && $('id_' + condition.action.field).hide());
                    } else {
                        ($('id_' + condition.action.field) && $('id_' + condition.action.field).show());
                    }
                    
                    // Loop through all rules
                    $A(condition.terms).each(function(term){
                        var id = term.field;
                        
                        switch (JotForm.getInputType(id)) {
                            case "combined":
                                JotForm.setFieldConditions('id_' + id, 'keyup', condition);
                            break;
                            case "datetime":
                                JotForm.setFieldConditions('id_' + id, 'date:changed', condition);
                            break;
                            case "select":
                                JotForm.setFieldConditions('input_' + id, 'change', condition);
                                break;
                            case "checkbox":
                            case "radio":
                                JotForm.setFieldConditions('id_' + id, 'click', condition);
                                break;
                            default: // text, textarea
                               JotForm.setFieldConditions('input_' + id, 'keyup', condition);
                        }
                    });
                    
                } else {
                    $A(condition.terms).each(function(term){
                        var id = term.field;
                        var nextButton = JotForm.getSection($('id_' + id)).select('.form-pagebreak-next')[0];
                        if (!nextButton) {
                            return;
                        }
                        
                        nextButton.observe('mousedown', function(){
                            JotForm.warn('Checking ' + $('label_' + id).innerHTML.strip());
                            JotForm.checkCondition(condition);
                        });
                    });
                }
            });
            
            $H(JotForm.fieldConditions).each(function(pair){
                var field = pair.key;
                var event = pair.value.event;
                var conds = pair.value.conditions;
                
                JotForm.info("Has Condition:", field, $(field));
                // If field is not found then continue
                if(!$(field)){ return; }
                
                $(field).observe(event, function(){
                    $A(conds).each(function(cond){
                        var idf = field.replace(/.*_(\d+)/gim, '$1');
                        JotForm.warn('Checking ' + $('label_' + idf).innerHTML.strip(), ", Field Type: "+JotForm.getInputType(idf));
                        JotForm.checkCondition(cond);
                    });
                }).run(event);
            });
        }catch(e){ 
            JotForm.error(e); 
        }
    },
    /**
     * Calculates the payment total with quantites
     * @param {Object} prices
     */
    countTotal: function(prices){
    
        var total = 0;
        $H(prices).each(function(pair){
            total = parseFloat(total);
            var price = parseFloat(pair.value.price);
            if ($(pair.key).checked) {
                if ($(pair.value.quantityField)) {
                    price = price * parseInt($(pair.value.quantityField).getSelected().text, 10);
                }
                total += price;
            }
        });
        
        if (total === 0) {
            total = "0.00";
        }
        if ($("payment_total")) {
            $("payment_total").update(parseFloat(total).toFixed(2))            
        }
    },
    /**
     * Sets the events for dynamic total calculation
     * @param {Object} prices
     */
    totalCounter: function(prices){
        $H(prices).each(function(pair){
            $(pair.key).observe('click', function(){
                JotForm.countTotal(prices);
            });
            if ($(pair.value.quantityField)) {
                $(pair.value.quantityField).observe('change', function(){
                    JotForm.countTotal(prices);
                });
            }
        });
    },
    /**
     * Initiates the capctha element
     * @param {Object} id
     */
    initCaptcha: function(id){
        
        new Ajax.Jsonp(JotForm.server, {
            parameters: {
                action: 'getCaptchaId'
            },
            evalJSON: 'force',
            onComplete: function(t){
                t = t.responseJSON || t;
                if (t.success) {
                    $(id + '_captcha').src = JotForm.url + 'server.php?action=getCaptchaImg&code=' + t.num;
                    $(id + '_captcha_id').value = t.num;
                }
            }
        });
        
    },
    /**
     * Relads a new image for captcha
     * @param {Object} id
     */
    reloadCaptcha: function(id){
        $(id + '_captcha').src = JotForm.url+'images/blank.gif';
        JotForm.initCaptcha(id);
    },
    /**
     * Zero padding for a given number
     * @param {Object} n
     * @param {Object} totalDigits
     */
    addZeros: function(n, totalDigits){
        n = n.toString();
        var pd = '';
        if (totalDigits > n.length) {
            for (i = 0; i < (totalDigits - n.length); i++) {
                pd += '0';
            }
        }
        return pd + n.toString();
    },
    /**
     * @param {Object} d
     */
    formatDate: function(d){
        var date = d.date;
        var month = JotForm.addZeros(date.getMonth() + 1, 2);
        var day = JotForm.addZeros(date.getDate(), 2);
        var year = date.getYear() < 1000 ? date.getYear() + 1900 : date.getYear();
        
        var hour = JotForm.addZeros(date.getHours(), 2); // May not need
        var min = JotForm.addZeros(date.getMinutes(), 2); // May not need
        var id = d.dateField.id.replace(/\w+\_/gim, '');
        $('month_' + id).value = month;
        $('day_' + id).value = day;
        $('year_' + id).value = year;
        if($('hour_'+id)){
            if($('ampm_'+id)){
                var ap = 'AM';
                if (hour   > 11) { ap = "PM";        }
                if (hour   > 12) { hour = hour - 12; }
                if (hour   == 0) { hour = 12;        }
                $('hour_'+id).value = hour;
                $('ampm_'+id).selectOption(ap);
            }else{
                $('hour_'+id).value = hour;
            }
        }
        
        if($('min_'+id)){
            $('min_'+id).value = min;
        }
        $('id_'+id).fire('date:changed');
    },
    /**
     * Highlights the lines when an input is focused
     */
    highLightLines: function(){
        
        // Highlight selected line
        $$('.form-line').each(function(l, i){
            l.select('input, select, textarea, div, table div, button').each(function(i){
                
                i.observe('focus', function(){
                    if (JotForm.isCollapsed(l)) {
                        JotForm.getCollapseBar(l).run('click');
                    }
                    if(!this.highlightInputs){ return; }
                    l.addClassName('form-line-active');
                    // for descriptions
                    if(l.__classAdded){ l.__classAdded = false; }
                }).observe('blur', function(){
                    if(!this.highlightInputs){ return; }
                    l.removeClassName('form-line-active');
                });
            });
        });
    },
    /**
     * Gets the container FORM of the element
     * @param {Object} element
     */
    getForm: function(element){
        element = $(element);
        if (!element.parentNode) {
            return false;
        }
        if (element && element.tagName == "BODY") {
            return false;
        }
        if (element.tagName == "FORM") {
            return $(element);
        }
        return JotForm.getForm(element.parentNode);
    },
    /**
     * Gets the container of the input
     * @param {Object} element
     */
    getContainer: function(element){
        element = $(element);
        if (!element.parentNode) {
            return false;
        }
        if (element && element.tagName == "BODY") {
            return false;
        }
        if (element.hasClassName("form-line")) {
            return $(element);
        }
        return JotForm.getContainer(element.parentNode);
    },
    
    /**
     * Get the containing section the element
     * @param {Object} element
     */
    getSection: function(element){
        element = $(element);
        if (!element.parentNode) {
            return false;
        }
        if (element && element.tagName == "BODY") {
            return false;
        }
        if (element.hasClassName("form-section-closed") || element.hasClassName("form-section")) {
            return element;
        }
        return JotForm.getSection(element.parentNode);
    },
    /**
     * Get the fields collapse bar
     * @param {Object} element
     */
    getCollapseBar: function(element){
        element = $(element);
        if (!element.parentNode) {
            return false;
        }
        if (element && element.tagName == "BODY") {
            return false;
        }
        if (element.hasClassName("form-section-closed") || element.hasClassName("form-section")) {
            return element.select('.form-collapse-table')[0];
        }
        return JotForm.getCollapseBar(element.parentNode);
    },
    /**
     * Check if the input is collapsed
     * @param {Object} element
     */
    isCollapsed: function(element){
        element = $(element);
        if (!element.parentNode) {
            return false;
        }
        if (element && element.tagName == "BODY") {
            return false;
        }
        if (element.className == "form-section-closed") {
            return true;
        }
        return JotForm.isCollapsed(element.parentNode);
    },
    /**
     * Check if the input is visible
     * @param {Object} element
     */
    isVisible: function(element){
        element = $(element);
        if (!element.parentNode) {
            return false;
        }
        
        if (element && element.tagName == "BODY") {
            return true;
        }
        
        if (element.style.display == "none" || element.style.visibility == "hidden") {
            return false;
        }
        
        return JotForm.isVisible(element.parentNode);
    },
    /**
     * Enables back the buttons
     */
    enableButtons: function(){
        setTimeout(function(){
            $$('.form-submit-button').each(function(b){
                b.enable();
                b.innerHTML = b.oldText;
            });
        }, 60);
    },
    
    /**
     * Sets the actions for buttons
     * - Disables the submit when clicked to prevent double submit.
     * - Adds confirmation for form reset
     * - Handles the print button
     */
    setButtonActions: function(){
    
        $$('.form-submit-button').each(function(b){
            b.oldText = b.innerHTML;
            b.enable(); // enable previously disabled button
            
            b.observe('click', function(){
                setTimeout(function(){
                    b.innerHTML = JotForm.texts.pleaseWait;
                    b.disable();
                    setTimeout(function(){
                        JotForm.enableButtons();
                    }, 25000); // Wait 5 seconds if nothing happens enable the button back
                }, 50);
            });
        });
        
        $$('.form-submit-reset').each(function(b){
            b.onclick = function(){
                if (!confirm(JotForm.texts.confirmClearForm)) {
                    return false;
                }
            };
        });
        
        $$('.form-submit-print').each(function(print_button){
        
            print_button.observe("click", function(){
                $(print_button.parentNode).hide();
                $$('.form-textarea, .form-textbox').each(function(el){
                    el.insert({
                        before: new Element('div', {
                            className: 'print_fields'
                        }).update(el.value.replace(/\n/g, '<br>')).setStyle('border:1px solid #ccc; padding:5px;')
                    }).hide();
                });
                window.print();
                $$('.form-textarea, .form-textbox').invoke('show');
                $$('.print_fields').invoke('remove');
                $(print_button.parentNode).show();
            });
            
        });
    },
    /**
     * Handles the functionality of control_grading tool
     */
    initGradingInputs: function(){
    
        $$('.form-grading-input').each(function(item){
            item.observe('blur', function(){
                var id = item.id.replace(/input_(\d+)_\d+/, "$1");
                var total = 0;
                
                $("grade_error_" + id).innerHTML = "";
                
                $(item.parentNode.parentNode).select(".form-grading-input").each(function(sibling){
                    var stotal = parseFloat(sibling.value) || 0;
                    total += stotal;
                });
                
                var allowed_total = parseFloat($("grade_total_" + id).innerHTML);
                
                $("grade_point_" + id).innerHTML = total;
                
                if (total > allowed_total) {
                    $("grade_error_" + id).innerHTML = ' ' + JotForm.texts.lessThan + ' <b>' + allowed_total + '</b>.';
                }
            });
        });
        
    },
    
    /**
     * Handles the pages of the form
     */
    backStack: [],
    currentSection: false,
    
    handlePages: function(){
        var pages = [];
        $$('.form-pagebreak').each(function(page, i){
            var section = $(page.parentNode.parentNode);
            if (i >= 1) {
                // Hide other pages
                section.hide();
            }else{
                JotForm.currentSection = section;
            }
            pages.push(section); // Collect pages
            
            section.pagesIndex = i+1;
            
            section.select('.form-pagebreak-next').invoke('observe', 'click', function(){ // When next button is clicked
                if(JotForm.saving){return;}
                if (JotForm.validateAll(JotForm.getForm(section))) {
                    
                    if(JotForm.nextPage){
                        JotForm.backStack.push(section.hide()); // Hide current
                        JotForm.currentSection = JotForm.nextPage.show();
                        JotForm.currentSection.scrollIntoView(); // Show next page
                    }else if (section.next()) { // If there is a next page
                        JotForm.backStack.push(section.hide()); // Hide current
                        // This code will be replaced with condition selector
                        JotForm.currentSection = section.next().show();
                        JotForm.currentSection.scrollIntoView(); // Show next page
                    }
                    
                    JotForm.nextPage = false;
                    if(JotForm.saveForm){
                        JotForm.hiddenSubmit(JotForm.getForm(section));
                    }
                }
            });
            
            section.select('.form-pagebreak-back').invoke('observe', 'click', function(){ // When back button is clicked
                if(JotForm.saving){return;}
                section.hide();            
                JotForm.currentSection = JotForm.backStack.pop().show();
                JotForm.currentSection.scrollIntoView(); // Show next page
                JotForm.nextPage = false;
                if(JotForm.saveForm){
                    JotForm.hiddenSubmit(JotForm.getForm(section));
                }
            });
            
        });
        
        // Handle trailing page
        if (pages.length > 0) {
            var allSections = $$('.form-section');
            if (allSections.length > 0) {
                var last = allSections[allSections.length - 1];
            }
            
            // if there is a last page
            if (last) {
                last.pagesIndex = allSections.length;
                pages.push(last); // add it with the other pages
                last.hide(); // hide it until we open it
                var li = new Element('li', {
                    className: 'form-input-wide'
                });
                var cont = new Element('div', {
                    className: 'form-pagebreak'
                });
                var backCont = new Element('div', {
                    className: 'form-pagebreak-back-container'
                });
                var back = $$('.form-pagebreak-back-container')[0].select('button')[0];
                
                back.observe('click', function(){
                    if(JotForm.saving){return;}
                    last.hide();
                    JotForm.nextPage = false;
                });
                
                backCont.insert(back);
                cont.insert(backCont);
                li.insert(cont);
                last.insert(li);
            }
        }
        
    },
    /**
     * Handles the functionality of Form Collapse tool
     */
    handleFormCollapse: function(){
        var openBar = false;
        var openCount = 0;
        $$('.form-collapse-table').each(function(bar){
            var section = $(bar.parentNode.parentNode);
            section.setUnselectable();
            
            if (section.className == "form-section-closed") {
                section.closed = true;
            } else {
                if (!(section.select('.form-collapse-hidden').length > 0)) {
                    openBar = section;
                    openCount++;
                }
            }
            bar.observe('click', function(){
            
                if (section.closed) {
                
                    section.setStyle('overflow:visible; height:auto');
                    var h = section.getHeight();
                    
                    if (openBar && openBar != section && openCount <= 1) {
                        openBar.className = "form-section-closed";
                        openBar.shift({
                            height: 60,
                            duration: 0.5
                        });
                        openBar.select('.form-collapse-right-show').each(function(e){
                            e.addClassName('form-collapse-right-hide').removeClassName('form-collapse-right-show');
                        });
                        openBar.closed = true;
                    }
                    openBar = section;
                    section.setStyle('overflow:hidden; height:60px');
                    // Wait for focus
                    setTimeout(function(){
                        section.scrollTop = 0;
                        section.className = "form-section";
                    }, 1);
                    
                    section.shift({
                        height: h,
                        duration: 0.5,
                        onEnd: function(e){
                            e.scrollTop = 0;
                            e.setStyle("height:auto;");
                            e.scrollIntoView();
                        }
                    });
                    section.select('.form-collapse-right-hide').each(function(e){
                        e.addClassName('form-collapse-right-show').removeClassName('form-collapse-right-hide');
                    });
                    section.closed = false;
                } else {
                
                    section.scrollTop = 0;
                    section.shift({
                        height: 60,
                        duration: 0.5,
                        onEnd: function(e){
                            e.className = "form-section-closed";
                        }
                    });
                    openBar.select('.form-collapse-right-show').each(function(e){
                        e.addClassName('form-collapse-right-hide').removeClassName('form-collapse-right-show');
                    });
                    section.closed = true;
                }
            });
        });
    },
    /**
     * Shows or Hides the credit card form according to payment method selected
     * for PayPalPro
     */
    handlePayPalProMethods: function(){
        if ($('creditCardTable')) {
            $$('.paymentTypeRadios').each(function(radio){
                radio.observe('click', function(){
                    if (radio.checked && radio.value == "express") {
                        $('creditCardTable').hide();
                    }
                    if (radio.checked && radio.value == "credit") {
                        $('creditCardTable').show();
                    }
                });
            });
        }
    },
    
    /**
     * Creates description boxes next to input boxes
     * @param {Object} input
     * @param {Object} message
     */
    description: function(input, message){
        // v2 has bugs, v3 has stupid solutions
        if(message == "20"){ return; } // Don't remove this or some birthday pickers will start to show 20 as description
        
        var lineDescription = false;
        if(!$(input)){
            var id = input.replace(/[^\d]/gim, '');
            if($("id_"+id)){
                input = $("id_"+id);
                lineDescription = true;
            }else if($('section_'+id)){
                input = $('section_'+id);
                lineDescription = true;
            }else{
                return; /* no element found to display a description */             
            }
        }
        
        if($(input).setSliderValue){
            input = $($(input).parentNode);            
        }
        
        var cont = JotForm.getContainer(input);
        if(!cont){
            return;
        }
        var right = false;
        
        var bubble = new Element('div', { className: 'form-description'});
        var arrow = new Element('div', { className: 'form-description-arrow' });
        var arrowsmall = new Element('div', { className: 'form-description-arrow-small' });
        var content = new Element('div', { className: 'form-description-content' });
        
        if("desc" in document.get && document.get.desc == 'v2'){
            right = true;
            var indicator;
            cont.insert(indicator = new Element('div', {className:'form-description-indicator'}));
            bubble.addClassName('right');
        }
        
        content.insert(message);
        bubble.insert(arrow).insert(arrowsmall).insert(content).hide();
        
        cont.insert(bubble);
        
        if((cont.getWidth()/2) < bubble.getWidth()){
            bubble.setStyle('right: -' + ( cont.getWidth() - ( right ? 100 : 20 ) ) + 'px');
        }
        
        if(right){
            var h = indicator.measure('height');
            arrow.setStyle('top:'+((h /2) - 20)+'px');
            arrowsmall.setStyle('top:'+((h /2) - 17)+'px');
            
            $(cont).mouseEnter(function(){
                cont.setStyle('z-index:10000');
                if(!cont.hasClassName('form-line-active')){
                    cont.addClassName('form-line-active');
                    cont.__classAdded = true;
                }
                bubble.show();
            }, function(){
                if(cont.__classAdded){
                    cont.removeClassName('form-line-active');
                    cont.__classAdded = false;
                }
                cont.setStyle('z-index:0');
                bubble.hide();
            });
            $(input).observe('keydown', function(){
                cont.setStyle('z-index:0');
                bubble.hide();
            });
        }else{
            if(lineDescription){
                $(input).mouseEnter(function(){
                    cont.setStyle('z-index:10000');
                    bubble.show();
                }, function(){
                    cont.setStyle('z-index:0');
                    bubble.hide();
                });
            }else{
                $(cont).mouseEnter(function(){
                    cont.setStyle('z-index:10000');
                    bubble.show();
                }, function(){
                    cont.setStyle('z-index:0');
                    bubble.hide();
                });
                $(input).observe('keyup', function(){
                    cont.setStyle('z-index:0');
                    bubble.hide();
                });
                $(input).observe('focus', function(){
                    cont.setStyle('z-index:10000');
                    bubble.show();
                });
                $(input).observe('blur', function(){
                    cont.setStyle('z-index:0');
                    bubble.hide();
                });
            }
        }
    },
    
    /**
     * do all validations at once and stop on the first error
     * @param {Object} form
     */
    validateAll: function(form){
        var ret = true;
        
        if($$('.form-textarea-limit-indicator-error')[0]){
            ret = false;
        }
        
        var c = "";
        if(form && form.id){
            c = "#"+form.id+" ";
        }
        
        $$(c + '*[class*="validate"]').each(function(input){
            if(input.validateInput === undefined){ return; /* continue; */ }
            if (!(!!input.validateInput && input.validateInput())) {
                ret = false;                
                //throw $break; // stop at the first error
            }
        });
        
        return ret;
    },
    
    /**
     * When an input is errored
     * @param {Object} input
     * @param {Object} message
     */
    errored: function(input, message){
        
        input = $(input);
        
        if (input.errored) {
            return false;
        }
        
        if(input.runHint){
            input.runHint();
        }else{
            //input.select();
        }  
        
        if (JotForm.isCollapsed(input)) {

            var collapse = JotForm.getCollapseBar(input);
            if (!collapse.errored) {
                collapse.select(".form-collapse-mid")[0].insert({
                    top: '<img src="'+this.url+'images/exclamation-octagon.png" align="bottom" style="margin-right:5px;"> '
                }).setStyle({ color: 'red' });
                collapse.errored = true;
            }
        }
        var container = JotForm.getContainer(input);

        input.errored = true;
        input.addClassName('form-validation-error');
        container.addClassName('form-line-error');
        var insertEl = container;
        
        //if(JotForm.debug){
            insertEl = container.select('.form-input')[0];
            if (!insertEl) {
                insertEl = container.select('.form-input-wide')[0];
            }
            if(!insertEl){
                insertEl = container;
            }
        //}
        insertEl.select('.form-error-message').invoke('remove');
        
        insertEl.insert(new Element('div', {
            className: 'form-error-message'
        }).insert('<img src="'+this.url+'images/exclamation-octagon.png" align="left" style="margin-right:5px;"> ' + message).insert(
        new Element('div', {className:'form-error-arrow'}).insert(new Element('div', {className:'form-error-arrow-inner'}))));
        
        return false;
    },
    
    /**
     * When an input is corrected
     * @param {Object} input
     */
    corrected: function(input){
        JotForm.hideButtonMessage();
        input = $(input);
        input.errored = false;
        if (JotForm.isCollapsed(input)) {
            var collapse = JotForm.getCollapseBar(input);
            if (collapse.errored) {
                collapse.select(".form-collapse-mid")[0].setStyle({
                    color: ''
                }).select('img')[0].remove();
                collapse.errored = false;
            }
        }
        var container = JotForm.getContainer(input);
        if(!container){ return true; }
        container.select(".form-validation-error").invoke('removeClassName', 'form-validation-error');
        container.removeClassName('form-line-error');
        container.select('.form-error-message').invoke('remove');
        return true;
    },
    
    hideButtonMessage: function(){
        $$('.form-button-error').invoke('remove');
    },
    
    showButtonMessage: function(){
        this.hideButtonMessage();
        
        $$('.form-submit-button').each(function(button){
            var errorBox = new Element('div', {className:'form-button-error'});
            errorBox.insert(JotForm.texts.incompleteFields);
            $(button.parentNode).insert(errorBox);
        });
    },
    
    /**
     * Sets all validations to forms
     */
    validator: function(){
        
        if(this.debugOptions && this.debugOptions.stopValidations){
            this.info('Validations stopped by debug parameter');
            return true;
        }
        var $this = this;
        var reg = {
            email: /[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])/i,
            alphanumeric: /^[a-zA-Z0-9]+$/,
            numeric: /^(\d+[\.]?)+$/,
            alphabetic: /^[a-zA-Z\s]+$/
        };
        
        $A(JotForm.forms).each(function(form){ // for each JotForm form on the page 
            if (form.validationSet) {
                return; /* continue; */
            }
            
            form.validationSet = true;
            form.observe('submit', function(e){ // Set on submit validation
                try {
                    if (!JotForm.validateAll(form)) {
                        JotForm.enableButtons();
                        JotForm.showButtonMessage();
                        e.stop();
                    }
                } catch (err) {
                    JotForm.error(err);
                    e.stop();
                }
            });
            
            // for each validation element
            $$('#'+form.id+' *[class*="validate"]').each(function(input){
                
                var validations = input.className.replace(/.*validate\[(.*)\].*/, '$1').split(/\s*,\s*/);
                
                input.validateInput = function(deep){
                
                    if (!JotForm.isVisible(input)) {
                        return true; // if it's hidden then user cannot fill this field then don't validate
                    }
                    
                    JotForm.corrected(input); // First clean the element
                    
                    var vals = validations;
                    
                    if(input.hinted === true){
                        input.clearHint();
                        setTimeout(function(){
                            input.hintClear();
                        }, 150);
                    } // Clear hint value if exists
                    
                    if (vals.include("required")) {
                        if (input.tagName == 'INPUT' && input.readAttribute('type') == "file") {
                            if(input.value.empty() && !input.uploadMarked){
                                return JotForm.errored(input, JotForm.texts.required);
                            }else{
                                return JotForm.corrected(input);
                            }
                            
                        }else if (input.tagName == "INPUT" && (input.readAttribute('type') == "radio" || input.readAttribute('type') == "checkbox")) {
                            if ( ! $A(document.getElementsByName(input.name)).map(function(e){ return e.checked; }).any()) {
                                return JotForm.errored(input, JotForm.texts.required);
                            }
                        } else if (input.name && input.name.include("[")) {

                            try{
                                var cont = $this.getContainer(input);
                                var checkValues = cont.select('input[name*=' + input.name.replace(/\[.*$/, '') + ']').map(function(e){
                                    
                                    // If this is an address field and country is not United States or Canada 
                                    // then don't require state name
                                    if(e.hasClassName('form-address-state')){
                                        var country = cont.select('.form-address-country')[0].value;
                                        if(country != 'United States' && country != 'Canada' && country != 'Please Select'){
                                            e.removeClassName('form-validation-error');
                                            e.__skipField = true;
                                            return false;
                                        }
                                    }else{
                                        if(e.__skipField){
                                            e.__skipField = false;
                                        }
                                    }
                                    
                                    if(e.className.include('validate[required]') && JotForm.isVisible(e)){
                                        if(e.value.empty() || e.value.strip() == 'Please Select'){
                                            e.addClassName('form-validation-error')
                                            return true;
                                        }
                                    }
                                    e.removeClassName('form-validation-error');
                                    return false;
                                });
                                
                                if (checkValues.any()) {
                                    return JotForm.errored(input, JotForm.texts.required);
                                }
                            }catch(e){
                                // This can throw errors on internet explorer
                                JotForm.error(e);
                                return JotForm.corrected(input);
                            }
                        }
                        if(input.__skipField){
                            return JotForm.corrected(input);
                        }
                        if ( (!input.value || input.value.empty() || input.value == 'Please Select') && !(input.readAttribute('type') == "radio" || input.readAttribute('type') == "checkbox") ) {
                            return JotForm.errored(input, JotForm.texts.required);
                        }
                        vals = vals.without("required");
                        
                    } else if (input.value.empty()) {
                        // if field is not required and there is no value 
                        // then skip other validations
                        return true;
                    }
                    
                    if (!vals[0]) {
                        return true;
                    }
                    
                    switch (vals[0]) {
                        case "Email":
                            if (!reg.email.test(input.value)) {
                                return JotForm.errored(input, JotForm.texts.email);
                            }
                            break;
                        case "Alphabetic":
                            if (!reg.alphabetic.test(input.value)) {
                                return JotForm.errored(input, JotForm.texts.alphabetic);
                            }
                            break;
                        case "Numeric":
                            if (!reg.numeric.test(input.value)) {
                                return JotForm.errored(input, JotForm.texts.numeric);
                            }
                            break;
                        case "AlphaNumeric":
                            if (!reg.alphanumeric.test(input.value)) {
                                return JotForm.errored(input, JotForm.texts.alphanumeric);
                            }
                            break;
                        default:
                            // throw ("This validation is not valid (" + vals[0] + ")");
                    }
                    return JotForm.corrected(input);
                };
                var validatorEvent = function(e){
                    setTimeout(function(){ // to let focus event to work
                        if($this.lastFocus && ($this.lastFocus == input || $this.getContainer($this.lastFocus) != $this.getContainer(input))){
                            input.validateInput();
                        }else if(input.type == "hidden"){
                            input.validateInput(); // always run on hidden elements
                        }
                    }, 10);
                };
                
                if(input.type == 'hidden'){
                    input.observe('change', validatorEvent);
                }else{
                    input.observe('blur', validatorEvent);
                }
            });
            
            $$('.form-upload').each(function(upload){
               
                try {

                    var required = !!upload.validateInput;
                    var exVal = upload.validateInput || Prototype.K;
                    
                    upload.validateInput = function(){
                        if (exVal() !== false) { // Make sure other validation completed
                            
                            if(!upload.files){ return true; } // If files are not provied then don't do checks
                            
                            var acceptString = upload.readAttribute('accept') || upload.readAttribute('file-accept') || "";
                            var maxsizeString = upload.readAttribute('maxsize') || upload.readAttribute('file-maxsize') || "";
                            
                            var accept = acceptString.strip().split(/\s*\,\s*/gim);
                            var maxsize = parseInt(maxsizeString, 10) * 1024;
                            
                            var file = upload.files[0];
                            if (!file) {
                                return true;
                            } // No file was selected
                
                            var ext = "";
                            if( JotForm.getFileExtension(file.fileName) ){
                                ext = JotForm.getFileExtension(file.fileName);
                            }
                            
                            if ( acceptString != "*" && !accept.include(ext) && !accept.include(ext.toLowerCase())) {
                                return JotForm.errored(upload, JotForm.texts.uploadExtensions + ' ' + acceptString);
                            }
                            
                            if (file.fileSize > maxsize) {
                                return JotForm.errored(upload, JotForm.texts.uploadFilesize + ' ' + maxsizeString + 'Kb');
                            }
                            
                            return JotForm.corrected(upload);
                        }
                    };
                    
                    if (!required) {
                        upload.addClassName('validate[upload]');
                        upload.observe('blur', upload.validateInput);
                    }
                } catch (e) {

                    JotForm.error(e);

                }

            }); 
        });
    }
};