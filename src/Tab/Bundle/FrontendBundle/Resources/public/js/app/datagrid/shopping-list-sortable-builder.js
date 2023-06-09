define([
    'underscore',
    'oroui/js/mediator',
], function(_, mediator) {
    'use strict';

    return {

        collection: null,

        checkingRequired: false,

        processDatagridOptions(deferred, options) {
            _.each(options.data.data, (e, i) => _.extend(e, {
                ordinal: i,
                row_attributes: {'data-id': e.id},
                checked: e.checked || !!e.orderId,
                row_class_name: `${e.row_class_name} ${e.orderId ? 'ordered' : ''}`,
            }));
            deferred.resolve();
        },

        init(deferred, {gridPromise}) {
            gridPromise.done(({collection, body: {$el}}) => {
                this.collection = collection;
                this.checkRequired(collection.first());
                collection
                    .on('change:checked', model => {
                        if (model.get('ordinal')) {
                            this.checkRequired(model);
                        } else {
                            model.set('checked', true);
                        }
                    })
                    .on('beforeFetch', () => this.saveLineItemsInfo())
                    .on('reset', () => this.loadLineItemsInfo());
                mediator.on('workflow:transition:execute', event => {
                    const transitionUrl = event.element.data('transitionUrl') || '';
                    if (transitionUrl.search('/start_from_shoppinglist') > 0) {
                        this.saveLineItemsInfo();
                        event.data = JSON.stringify({shopping_list_items_info: JSON.stringify(this.lineItemsInfo)});
                    }
                });

                let extRow;
                $el.sortable({
                    items: '.grid-row:not(.ordered,.extension-row)',
                    start: (e, {placeholder}) => extRow = placeholder.next('.extension-row'),
                    update: (e, {item}) => {
                        item.prev().after(item.next('.extension-row'));
                        item.after(extRow);
                        _.each($el.sortable('instance').items, ({item: e}) => {
                            // Update ordinal for each line item
                            const id = e.data('id');
                            collection.get(id).set('ordinal', e.index(), {silent: true});
                        });
                        this.checkRequired(collection.get(item.data('id')), true);
                    },
                });
                deferred.resolve();
            }).fail(function() {
                deferred.reject();
            });
        },

        checkRequired(targetModel, ddMode = false) {
            if (this.checkingRequired) {
                return;
            }
            this.checkingRequired = true;
            this.collection.each(model => {
                if (!model.get('ordinal')) {
                    // always check the first one
                    model.set('checked', true);
                    return;
                }
                const targetChecked = targetModel.get('checked');
                const targetOrdinal = targetModel.get('ordinal');
                const checked = model.get('checked');
                const ordinal = model.get('ordinal');

                if (targetChecked && ordinal < targetOrdinal) {
                    // DD checked row will make others checked
                    model.set('checked', true);
                } else if (!targetChecked && ordinal > targetOrdinal) {
                    if (!ddMode) {
                        model.set('checked', false);
                    } else if (checked) {
                        // DD un checked row will make it self checked
                        targetModel.set('checked', true);
                    }
                }
            });
            this.checkingRequired = false;
        },

        saveLineItemsInfo() {
            this.lineItemsInfo = this.collection.reduce(
                (memo, e) => _.extend(memo, {[e.id]: _.pick(e.attributes, 'checked', 'ordinal')}),
                {}
            );
        },

        loadLineItemsInfo() {
            this.collection.each(model => {
                const info = this.saveLineItemsInfo[model.id];
                info && model.set(info);
            });
        },
    };
});
