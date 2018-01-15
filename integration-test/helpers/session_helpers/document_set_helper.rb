require 'pathname'

module SessionHelpers
  module DocumentSetHelper
    def create_document_set_from_pdfs_in_folder(folder)
      folder = Pathname.new(folder).expand_path # absolute path

      visit('/')
      click_on('Upload files', wait: WAIT_LOAD)
      assert_selector('.upload-folder-prompt', wait: WAIT_LOAD)
      execute_script('document.querySelector(".upload-prompt .invisible-file-input").style.opacity = 1')
      for path in Dir.glob(File.join(folder, '*.*'))
        attach_file('file', path)
      end
      click_on('Done adding files')
      # Wait for focus: that's when the dialog is open
      wait_for_javascript_to_return_true('document.querySelector("#import-options-name") === document.activeElement', wait: WAIT_FAST)
      fill_in('Document set name', with: folder)
      click_on('Import documents')
      assert_selector('body.document-set-show', wait: WAIT_SLOW) # wait for import to complete
      assert_selector('#document-list:not(.loading) li.document', wait: WAIT_LOAD) # wait for document list to load
      # There are no plugins, so we don't need to wait for them

      # Hide the Tour
      click_link('Don’t show any more tips', wait: WAIT_FAST)
      assert_no_selector('.popover', wait: WAIT_FAST)
    end

    def create_document_set_from_csv(path)
      path = Pathname.new(path).expand_path # absolute path

      visit('/')
      click_on('Import from a CSV file', wait: WAIT_LOAD)
      attach_file('csv-upload-file', path, wait: WAIT_LOAD)
      click_button('Upload', match: :first, wait: WAIT_LOAD) # wait for upload to complete and JS to run

      assert_selector('body.document-set-show', wait: WAIT_SLOW) # wait for import to complete
      assert_selector('#document-list:not(.loading) li.document', wait: WAIT_LOAD) # wait for document list to load
      # There are no plugins, so we don't need to wait for them

      # Hide the Tour
      click_link('Don’t show any more tips', wait: WAIT_FAST)
      assert_no_selector('.popover', wait: WAIT_FAST)
    end

    def create_custom_view(options)
      raise ArgumentError.new('missing options[:name]') if !options[:name]
      raise ArgumentError.new('missing options[:url]') if !options[:url]
      click_on('Add view', wait: WAIT_FAST)
      click_on('Custom…', wait: WAIT_FAST)
      # Wait for focus: that's when the dialog is open
      wait_for_javascript_to_return_true('document.querySelector("#new-view-dialog-title") === document.activeElement', wait: WAIT_FAST)
      fill_in('Name', with: options[:name])
      fill_in('App URL', with: options[:url])
      fill_in('Overview’s URL from App server', with: OVERVIEW_URL)
      if options[:url] =~ /^http:/
        # dismiss HTTPS warning
        click_on('Create visualization')
        click_on('use it anyway', wait: WAIT_FAST)
      end
      click_on('Create visualization')

      # Wait for dialog to disappear.
      assert_no_selector('#new-view-dialog', wait: WAIT_LOAD)

      # Wait for new view to appear
      assert_selector('li.view span.title', text: options[:name], wait: WAIT_FAST)
      # And wait for it to begin loading. Without specific plugin knowledge, we
      # can't tell when it _ends_ loading.
      assert_selector('iframe#view-app-iframe', wait: WAIT_FAST)
    end

    def delete_current_view
      n_views_before = all('ul.view-tabs>li.view').count
      find('li.view.active .toggle-popover').click
      within('li.view.active .popover', wait: WAIT_FAST) do
        accept_confirm(wait: WAIT_FAST) do
          click_on('Delete')
        end
      end
      # Wait for the view to disappear
      assert_selector('ul.view-tabs>li.view', count: n_views_before - 1, wait: WAIT_LOAD)
    end
  end
end
