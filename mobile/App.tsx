import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { getTasks, addTask, deleteTask } from './src/db'
import { CATEGORIES, type Task, type TaskCategory } from './src/types'

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTab, setActiveTab] = useState<TaskCategory>('short_term')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const fetchTasks = useCallback(async () => {
    const data = await getTasks()
    setTasks(data)
  }, [])

  useEffect(() => {
    setIsLoading(true)
    fetchTasks().finally(() => setIsLoading(false))
  }, [fetchTasks])

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await fetchTasks()
    setIsRefreshing(false)
  }, [fetchTasks])

  const handleAddTask = async () => {
    const title = newTaskTitle.trim()
    if (!title) return

    setIsAdding(true)
    const task = await addTask(title, activeTab)
    if (task) {
      setTasks(prev => [task, ...prev])
      setNewTaskTitle('')
    } else {
      Alert.alert('Error', 'Failed to add task')
    }
    setIsAdding(false)
  }

  const handleDeleteTask = (task: Task) => {
    Alert.alert(
      'Delete Task',
      `Delete "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteTask(task.id)
            if (success) {
              setTasks(prev => prev.filter(t => t.id !== task.id))
            } else {
              Alert.alert('Error', 'Failed to delete task')
            }
          },
        },
      ]
    )
  }

  const filteredTasks = tasks.filter(t => t.category === activeTab)
  const activeCategory = CATEGORIES.find(c => c.key === activeTab)!

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity
      style={[styles.taskCard, { borderLeftColor: activeCategory.color }]}
      onLongPress={() => handleDeleteTask(item)}
    >
      <Text style={styles.taskTitle}>{item.title}</Text>
      {item.description && (
        <Text style={styles.taskDescription}>{item.description}</Text>
      )}
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>TooDoo</Text>
        <Text style={styles.headerSubtitle}>Long press to delete</Text>
      </View>

      <View style={styles.tabBar}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.tab,
              activeTab === cat.key && { borderBottomColor: cat.color, borderBottomWidth: 3 }
            ]}
            onPress={() => setActiveTab(cat.key)}
          >
            <Text style={[
              styles.tabText,
              activeTab === cat.key && { color: cat.color }
            ]}>
              {cat.title.split('-')[0]}
            </Text>
            <View style={[styles.countBadge, { backgroundColor: cat.color }]}>
              <Text style={styles.countText}>
                {tasks.filter(t => t.category === cat.key).length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={activeCategory.color} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={item => item.id}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={activeCategory.color}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubtext}>Add one below!</Text>
            </View>
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={[styles.inputRow, { borderColor: activeCategory.color }]}>
          <TextInput
            style={styles.input}
            placeholder={`Add ${activeCategory.title.toLowerCase()} task...`}
            placeholderTextColor="#666"
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            onSubmitEditing={handleAddTask}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: activeCategory.color }]}
            onPress={handleAddTask}
            disabled={isAdding || !newTaskTitle.trim()}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>+</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  countBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  taskCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  taskTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  taskDescription: {
    color: '#888',
    fontSize: 13,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 14,
    marginTop: 4,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 14,
  },
  addButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
})
