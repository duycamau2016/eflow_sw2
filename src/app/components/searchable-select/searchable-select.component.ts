import {
  Component, Input, Output, EventEmitter,
  HostListener, ElementRef, AfterViewChecked, ViewChild, OnDestroy
} from '@angular/core';

export interface SelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss']
})
export class SearchableSelectComponent implements AfterViewChecked, OnDestroy {
  @Input() value: any = null;
  @Output() valueChange = new EventEmitter<any>();

  @Input() options: SelectOption[] = [];
  @Input() placeholder = '-- Chọn --';
  @Input() searchPlaceholder = 'Tìm kiếm...';
  /** When provided, adds a "null" first option in the list */
  @Input() nullOption: string | null = null;

  @ViewChild('triggerEl') triggerRef?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  isOpen = false;
  searchQuery = '';
  panelStyles: Record<string, string> = {};

  private shouldFocus = false;

  constructor(private el: ElementRef) {}

  get filteredOptions(): SelectOption[] {
    if (!this.searchQuery) return this.options;
    const q = this.searchQuery.toLowerCase();
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  get selectedLabel(): string {
    if (this.value === null || this.value === undefined || this.value === '') {
      return this.nullOption ?? this.placeholder;
    }
    const found = this.options.find(o => o.value == this.value);
    return found?.label ?? this.placeholder;
  }

  get hasValue(): boolean {
    return this.value !== null && this.value !== undefined && this.value !== '';
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchQuery = '';
      this.shouldFocus = true;
      this.computePanelPosition();
    }
  }

  private computePanelPosition(): void {
    const trigger = this.triggerRef?.nativeElement ?? this.el.nativeElement.querySelector('.ss-trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 240 && rect.top > 240;

    this.panelStyles = {
      position: 'fixed',
      left: rect.left + 'px',
      width: rect.width + 'px',
      'z-index': '9999',
      ...(openUpward
        ? { bottom: (window.innerHeight - rect.top) + 'px', top: 'auto' }
        : { top: (rect.bottom + 4) + 'px', bottom: 'auto' })
    };
  }

  select(val: any): void {
    this.value = val;
    this.valueChange.emit(val);
    this.isOpen = false;
    this.searchQuery = '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onScrollOrResize(): void {
    if (this.isOpen) {
      this.computePanelPosition();
    }
  }

  trackByValue(_index: number, opt: SelectOption): any {
    return opt.value;
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocus && this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.focus();
      this.shouldFocus = false;
    }
  }

  ngOnDestroy(): void {
    this.isOpen = false;
  }
}
