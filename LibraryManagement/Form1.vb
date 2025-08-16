Imports System
Imports System.IO
Imports System.Windows.Forms
Imports System.Collections.Generic
Imports System.Drawing

Public Class Form1
    Inherits Form

    ' Controls
    Private lblTitle As Label
    Private lblAuthor As Label
    Private lblISBN As Label
    Private txtTitle As TextBox
    Private txtAuthor As TextBox
    Private txtISBN As TextBox
    Private btnAdd As Button
    Private btnDelete As Button
    Private btnSearch As Button
    Private btnView As Button
    Private lstBooks As ListBox
    Private txtSearch As TextBox

    ' Data
    Private BookList As New List(Of String)()
    Private dataFile As String = "books.txt"

    Public Sub New()
        ' ----- Form design -----
        Me.Text = "Library Management System"
        Me.Width = 600
        Me.Height = 500
        Me.StartPosition = FormStartPosition.CenterScreen
        Me.FormBorderStyle = FormBorderStyle.FixedSingle
        Me.MaximizeBox = False

        ' Set background color OR image
        Me.BackColor = Color.Beige
        ' If you want an image, uncomment this and place "background.jpg" in the same folder:
        ' Me.BackgroundImage = Image.FromFile("background.jpg")
        ' Me.BackgroundImageLayout = ImageLayout.Stretch

        ' ----- Labels -----
        lblTitle = New Label() With {.Text = "Title:", .Top = 20, .Left = 20, .Width = 80, .Font = New Font("Segoe UI", 10, FontStyle.Bold)}
        lblAuthor = New Label() With {.Text = "Author:", .Top = 60, .Left = 20, .Width = 80, .Font = New Font("Segoe UI", 10, FontStyle.Bold)}
        lblISBN = New Label() With {.Text = "ISBN:", .Top = 100, .Left = 20, .Width = 80, .Font = New Font("Segoe UI", 10, FontStyle.Bold)}

        ' ----- Textboxes -----
        txtTitle = New TextBox() With {.Top = 20, .Left = 120, .Width = 300}
        txtAuthor = New TextBox() With {.Top = 60, .Left = 120, .Width = 300}
        txtISBN = New TextBox() With {.Top = 100, .Left = 120, .Width = 300}

        ' ----- Buttons -----
        btnAdd = New Button() With {.Text = "Add Book", .Top = 140, .Left = 120, .Width = 100, .BackColor = Color.LightGreen}
        btnDelete = New Button() With {.Text = "Delete", .Top = 140, .Left = 230, .Width = 100, .BackColor = Color.IndianRed}
        btnView = New Button() With {.Text = "View All", .Top = 140, .Left = 340, .Width = 100, .BackColor = Color.LightBlue}

        ' ----- Search field -----
        txtSearch = New TextBox() With {.Top = 190, .Left = 120, .Width = 200}
        btnSearch = New Button() With {.Text = "Search", .Top = 190, .Left = 340, .Width = 100, .BackColor = Color.Khaki}

        ' ----- Listbox -----
        lstBooks = New ListBox() With {.Top = 230, .Left = 20, .Width = 540, .Height = 200, .Font = New Font("Consolas", 10)}

        ' ----- Add controls -----
        Me.Controls.Add(lblTitle)
        Me.Controls.Add(lblAuthor)
        Me.Controls.Add(lblISBN)
        Me.Controls.Add(txtTitle)
        Me.Controls.Add(txtAuthor)
        Me.Controls.Add(txtISBN)
        Me.Controls.Add(btnAdd)
        Me.Controls.Add(btnDelete)
        Me.Controls.Add(btnView)
        Me.Controls.Add(txtSearch)
        Me.Controls.Add(btnSearch)
        Me.Controls.Add(lstBooks)

        ' ----- Event handlers -----
        AddHandler btnAdd.Click, AddressOf AddBook
        AddHandler btnView.Click, AddressOf ViewBooks
        AddHandler btnDelete.Click, AddressOf DeleteBook
        AddHandler btnSearch.Click, AddressOf SearchBooks

        ' ----- Load existing data -----
        LoadBooksFromFile()
    End Sub

    ' ====== Methods ======
    Private Sub AddBook(sender As Object, e As EventArgs)
        If txtTitle.Text = "" Or txtAuthor.Text = "" Or txtISBN.Text = "" Then
            MessageBox.Show("Please fill in all fields.", "Warning")
            Return
        End If

        Dim entry As String = $"{txtTitle.Text}|{txtAuthor.Text}|{txtISBN.Text}"
        BookList.Add(entry)
        SaveBooksToFile()
        MessageBox.Show("Book added successfully!", "Info")
        ClearFields()
    End Sub

    Private Sub ViewBooks(sender As Object, e As EventArgs)
        DisplayBooks(BookList)
    End Sub

    Private Sub DeleteBook(sender As Object, e As EventArgs)
        If lstBooks.SelectedIndex = -1 Then
            MessageBox.Show("Please select a book to delete.", "Warning")
            Return
        End If
        BookList.RemoveAt(lstBooks.SelectedIndex)
        SaveBooksToFile()
        ViewBooks(Nothing, Nothing)
        MessageBox.Show("Book deleted.", "Info")
    End Sub

    Private Sub SearchBooks(sender As Object, e As EventArgs)
        Dim keyword As String = txtSearch.Text.ToLower()
        Dim filtered = BookList.FindAll(Function(b) b.ToLower().Contains(keyword))
        DisplayBooks(filtered)
    End Sub

    Private Sub DisplayBooks(list As List(Of String))
        lstBooks.Items.Clear()
        For Each b In list
            Dim parts() As String = b.Split("|"c)
            lstBooks.Items.Add($"Title: {parts(0)}, Author: {parts(1)}, ISBN: {parts(2)}")
        Next
    End Sub

    Private Sub ClearFields()
        txtTitle.Clear()
        txtAuthor.Clear()
        txtISBN.Clear()
    End Sub

    Private Sub LoadBooksFromFile()
        If File.Exists(dataFile) Then
            BookList = File.ReadAllLines(dataFile).ToList()
            ViewBooks(Nothing, Nothing)
        End If
    End Sub

    Private Sub SaveBooksToFile()
        File.WriteAllLines(dataFile, BookList)
    End Sub
End Class