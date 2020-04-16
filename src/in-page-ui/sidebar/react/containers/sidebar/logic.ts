import {
    UILogic,
    UIEvent,
    IncomingUIEvent,
    UIEventHandler,
    UIMutation,
} from 'ui-logic-core'
import { TaskState } from 'ui-logic-core/lib/types'
import { SidebarControllerEventEmitter } from '../../../types'
import { SidebarEnv, Page } from '../../types'
import { Annotation, AnnotationsManagerInterface } from 'src/annotations/types'
import { Result, ResultsByUrl } from 'src/overview/types'
import { PageUrlsByDay } from 'src/search/background/types'
import { Anchor, HighlightInteractionInterface } from 'src/highlighting/types'
import { loadInitial, executeUITask } from 'src/util/ui-logic'
import { page } from 'src/sidebar-overlay/sidebar/selectors'

export interface SidebarContainerState {
    loadState: TaskState
    annotationLoadState: TaskState
    searchLoadState: TaskState

    state: 'visible' | 'hidden'
    needsWaypoint: boolean
    appendLoader: boolean

    annotations: Annotation[]
    annotationModes: { [annotationUrl: string]: 'default' | 'edit' | 'delete' }

    showCommentBox: boolean
    commentBox: {
        anchor: Anchor
        form: {
            isCommentBookmarked: boolean
            isTagInputActive: boolean
            showTagsPicker: boolean
            tagSuggestions: string[]
            commentText: string
            isAnnotation: boolean
            tags: string[]
            initTagSuggestions: string[]
        }
    }

    deletePagesModel: {
        isDeletePagesModelShown: boolean
    }

    searchValue: string
    pageType: 'page' | 'all'
    searchType: 'notes' | 'page' | 'social'
    pageCount?: number
    noResults: boolean
    isBadTerm: boolean
    searchResults: Result[]
    resultsByUrl: ResultsByUrl
    resultsClusteredByDay: boolean
    annotsByDay: PageUrlsByDay

    // Everything below here is temporary

    activeAnnotationUrl: string
    hoverAnnotationUrl: string
    showCongratsMessage: boolean
    showClearFiltersBtn: boolean
    isSocialPost: boolean
    page: Page

    // Filter sidebar props
    showFiltersSidebar: boolean
    showSocialSearch: boolean
    annotsFolded: boolean
    // resultsSearchType: 'page' | 'notes' | 'social'

    annotCount?: number

    // Search result props
    areAnnotationsExpanded: boolean
    shouldShowCount: boolean
    isInvalidSearch: boolean
    totalResultCount: number

    isListFilterActive: boolean
    isSocialSearch: boolean
    tagSuggestions: string[]
}

export type SidebarContainerEvents = UIEvent<{
    show: null
    hide: null

    // Adding a new page comment
    addNewPageComment: null
    changePageCommentText: { comment: string }
    saveNewPageComment: {
        anchor: Anchor
        commentText: string
        tags: string[]
        bookmarked: boolean
    }
    cancelNewPageComment: null
    toggleNewPageCommentBookmark: null
    togglePageCommentTags: null
    toggleNewPageCommentTagPicker: null
    addNewPageCommentTag: { tag: string }
    deleteNewPageCommentTag: { tag: string }
    // closeComments: null,

    // Delete page(s) modal
    deletePages: null
    closeDeletePagesModal: null

    // Annotation boxes
    goToAnnotation: { annnotation: Annotation }
    editAnnotation: { annnotationUrl: string }
    deleteAnnotation: { annnotationUrl: string }
    toggleAnnotationBookmark: { annnotationUrl: string }
    handleAnnotationModeSwitch: {
        annotationUrl: string
        mode: 'default' | 'edit' | 'delete'
    }

    // Search
    changeSearchQuery: { searchQuery: string }
    togglePageType: null
    setPageType: { type: 'page' | 'all' }
    setSearchType: { type: 'notes' | 'page' | 'social' }
    setResultsSearchType: { type: 'notes' | 'page' | 'social' }
    setAnnotationsExpanded: { value: boolean }
    clearAllFilters: null
    fetchSuggestedTags: null
    fetchSuggestedDomains: null
    resetFiterPopups: null
    toggleShowFilters: null
}>

export interface SidebarContainerDependencies {
    sidebarEvents: SidebarControllerEventEmitter
    env: SidebarEnv
    annotationManager: AnnotationsManagerInterface
    currentTab: { id: number; url: string }
    highlighter: Pick<HighlightInteractionInterface, 'removeTempHighlights'>

    loadTagSuggestions: () => Promise<string[]>

    loadAnnotations(pageUrl: string): Promise<Annotation[]>
    searchAnnotations(
        query: string,
        pageUrl: string | null,
    ): Promise<{
        results: Result[]
        annotsByDay: PageUrlsByDay
        resultsByUrl: ResultsByUrl
    }>
    searchPages(query: string): Promise<Result[]>

    deleteAnnotation: (annotationUrl: string) => Promise<void>
}

type Incoming<EventName extends keyof SidebarContainerEvents> = IncomingUIEvent<
    SidebarContainerState,
    SidebarContainerEvents,
    EventName
>
type EventHandler<
    EventName extends keyof SidebarContainerEvents
> = UIEventHandler<SidebarContainerState, SidebarContainerEvents, EventName>

const INITIAL_COMMENT_BOX_STATE: SidebarContainerState['commentBox'] = {
    anchor: null,
    form: {
        isCommentBookmarked: false,
        isTagInputActive: false,
        showTagsPicker: false,
        tagSuggestions: [],
        commentText: '',
        isAnnotation: false,
        tags: [],
        initTagSuggestions: [],
    },
}

export class SidebarContainerLogic extends UILogic<
    SidebarContainerState,
    SidebarContainerEvents
>
// implements UIEventHandlers<SidebarContainerState, SidebarContainerEvents>
{
    constructor(private dependencies: SidebarContainerDependencies) {
        super()
    }

    getInitialState(): SidebarContainerState {
        return {
            loadState: 'pristine',
            annotationLoadState: 'pristine',
            searchLoadState: 'pristine',

            state: 'visible',
            annotationModes: {},

            commentBox: { ...INITIAL_COMMENT_BOX_STATE },
            deletePagesModel: {
                isDeletePagesModelShown: false,
            },

            pageType: 'all',
            // pageType: 'page',
            searchType: 'notes',
            // searchType: 'page',
            // resultsSearchType: 'page',

            annotsFolded: false,
            isSocialPost: false,
            needsWaypoint: false,
            appendLoader: false,
            annotations: [],
            activeAnnotationUrl: '',
            hoverAnnotationUrl: '',
            showCommentBox: false,
            searchValue: '',
            showCongratsMessage: false,
            showClearFiltersBtn: false,
            page: {} as any,
            showFiltersSidebar: false,
            showSocialSearch: false,
            pageCount: 0,
            annotCount: 0,
            noResults: false,
            isBadTerm: false,
            areAnnotationsExpanded: false,
            shouldShowCount: false,
            isInvalidSearch: false,
            totalResultCount: 0,
            isListFilterActive: false,
            searchResults: [],
            resultsByUrl: new Map(),
            resultsClusteredByDay: false,
            annotsByDay: {},
            isSocialSearch: false,
            tagSuggestions: [],
        }
    }

    init: EventHandler<'init'> = async ({ previousState }) => {
        await loadInitial<SidebarContainerState>(this, async () => {
            await this._maybeLoad(previousState, {})
        })
    }

    private async _loadAnnotations() {
        // Notes tab
        await executeUITask(this, 'annotationLoadState', async () => {
            const annotations = await this.dependencies.loadAnnotations(
                this.dependencies.currentTab.url,
            )
            this.emitMutation({ annotations: { $set: annotations } })
        })
    }

    private async _doSearch(
        state: Pick<
            SidebarContainerState,
            'searchType' | 'searchValue' | 'pageType'
        >,
    ) {
        // Pages tab
        await executeUITask(this, 'searchLoadState', async () => {
            if (state.searchType === 'page') {
                const results = await this.dependencies.searchPages(
                    state.searchValue,
                )
                this.emitMutation({
                    searchResults: { $set: results },
                    pageCount: { $set: results.length },
                    noResults: { $set: !results.length },
                })
            } else if (state.searchType === 'notes') {
                const result = await this.dependencies.searchAnnotations(
                    state.searchValue,
                    state.pageType === 'page'
                        ? this.dependencies.currentTab.url
                        : null,
                )
                this.emitMutation({
                    searchResults: { $set: result.results },
                    pageCount: { $set: result.results.length },
                    noResults: { $set: !result.results.length },
                    annotsByDay: { $set: result.annotsByDay },
                    resultsByUrl: { $set: result.resultsByUrl },
                })
            }
        })
    }

    cleanup() {}

    show: EventHandler<'show'> = () => {
        return { state: { $set: 'visible' } }
    }

    hide: EventHandler<'hide'> = () => {
        return { state: { $set: 'hidden' } }
    }

    addNewPageComment: EventHandler<'addNewPageComment'> = async () => {
        this.emitMutation({ showCommentBox: { $set: true } })
        const suggestions = await this.dependencies.loadTagSuggestions()
        this.emitMutation({
            commentBox: { form: { tagSuggestions: { $set: suggestions } } },
        })
    }

    changePageCommentText: EventHandler<'changePageCommentText'> = incoming => {
        return {
            commentBox: {
                form: { commentText: { $set: incoming.event.comment } },
            },
        }
    }

    saveNewPageComment: EventHandler<'changePageCommentText'> = () => {
        this.emitMutation({
            commentBox: { form: { showTagsPicker: { $set: false } } },
        })
        this.emitMutation({
            commentBox: { $set: INITIAL_COMMENT_BOX_STATE },
            showCommentBox: { $set: false },
        })
    }

    cancelNewPageComment: EventHandler<'cancelNewPageComment'> = () => {
        // TODO: this.props.highlighter.removeTempHighlights()
        return {
            commentBox: { $set: INITIAL_COMMENT_BOX_STATE },
            showCommentBox: { $set: false },
        }
    }

    toggleNewPageCommentBookmark: EventHandler<
        'toggleNewPageCommentBookmark'
    > = () => {
        return {
            commentBox: {
                form: {
                    isCommentBookmarked: { $apply: bookmarked => !bookmarked },
                },
            },
        }
    }

    toggleNewPageCommentTagPicker: EventHandler<
        'toggleNewPageCommentTagPicker'
    > = () => {
        return {
            commentBox: {
                form: { showTagsPicker: { $apply: active => !active } },
            },
        }
    }

    addNewPageCommentTag: EventHandler<'addNewPageCommentTag'> = incoming => {
        return {
            commentBox: {
                form: {
                    tags: {
                        $apply: (tags: string[]) => {
                            const tag = incoming.event.tag
                            return tags.includes(tag) ? tags : [...tags, tag]
                        },
                    },
                },
            },
        }
    }

    deleteNewPageCommentTag: EventHandler<
        'deleteNewPageCommentTag'
    > = incoming => {
        return {
            commentBox: {
                form: {
                    tags: {
                        $apply: (tags: string[]) => {
                            const tag = incoming.event.tag
                            const tagIndex = tags.indexOf(tag)
                            if (tagIndex === -1) {
                                return tags
                            }

                            tags = [...tags]
                            tags.splice(tagIndex, 1)
                            return tags
                        },
                    },
                },
            },
        }
    }

    goToAnnotation: EventHandler<'goToAnnotation'> = incoming => {}

    editAnnotation: EventHandler<'editAnnotation'> = incoming => {
        return {
            annotationModes: {
                [incoming.event.annnotationUrl]: { $set: 'default' },
            },
        }
    }

    deleteAnnotation: EventHandler<'deleteAnnotation'> = incoming => {
        this.dependencies.deleteAnnotation(incoming.event.annnotationUrl)
        return {
            annotationModes: {
                [incoming.event.annnotationUrl]: { $set: 'default' },
            },
        }
    }

    toggleAnnotationBookmark: EventHandler<
        'toggleAnnotationBookmark'
    > = incoming => {
        const annotationIndex = incoming.previousState.annotations.findIndex(
            annotation => (annotation.url = incoming.event.annnotationUrl),
        )
        const currentlyBookmarked =
            incoming.previousState.annotations[annotationIndex].hasBookmark
        const shouldBeBookmarked = !currentlyBookmarked
        this.emitMutation({
            annotations: {
                [annotationIndex]: {
                    hasBookmark: { $set: shouldBeBookmarked },
                },
            },
        })
        if (shouldBeBookmarked) {
        } else {
        }
    }

    handleAnnotationModeSwitch: EventHandler<
        'handleAnnotationModeSwitch'
    > = incoming => {
        return {
            annotationModes: {
                [incoming.event.annotationUrl]: { $set: incoming.event.mode },
            },
        }
    }

    changeSearchQuery: EventHandler<'changeSearchQuery'> = incoming => {
        return {
            searchValue: { $set: incoming.event.searchQuery },
        }
    }

    togglePageType: EventHandler<'togglePageType'> = incoming => {
        const currentPageType = incoming.previousState.pageType
        const toggledPageType = currentPageType === 'all' ? 'page' : 'all'
        this.setPageType({ ...incoming, event: { type: toggledPageType } })
    }

    setPageType: EventHandler<'setPageType'> = async ({
        previousState,
        event,
    }) => {
        console.log('set page type', event)
        const mutation = {
            pageType: { $set: event.type },
        }
        this.emitMutation(mutation)
        await this._maybeLoad(previousState, mutation)
    }

    setSearchType: EventHandler<'setSearchType'> = async ({
        previousState,
        event,
    }) => {
        console.log('set search type', event)
        const mutation = {
            searchType: { $set: event.type },
        }
        this.emitMutation(mutation)
        await this._maybeLoad(previousState, mutation)
    }

    // setResultsSearchType: EventHandler<'setResultsSearchType'> = incoming => {
    //     this.emitMutation({
    //         resultsSearchType: { $set: incoming.event.type },
    //     })
    // }

    setAnnotationsExpanded: EventHandler<
        'setAnnotationsExpanded'
    > = incoming => {}

    clearAllFilters: EventHandler<'clearAllFilters'> = incoming => {}

    fetchSuggestedTags: EventHandler<'fetchSuggestedTags'> = incoming => {}

    fetchSuggestedDomains: EventHandler<
        'fetchSuggestedDomains'
    > = incoming => {}

    resetFiterPopups: EventHandler<'resetFiterPopups'> = incoming => {}

    toggleShowFilters: EventHandler<'toggleShowFilters'> = incoming => {
        return { showFiltersSidebar: { $apply: show => !show } }
    }

    async _maybeLoad(
        state: SidebarContainerState,
        changes: UIMutation<SidebarContainerState>,
    ) {
        const nextState = this.withMutation(state, changes)
        if (nextState.searchType === 'notes' && nextState.pageType === 'page') {
            await this._loadAnnotations()
        } else {
            await this._doSearch(nextState)
        }
    }
}
